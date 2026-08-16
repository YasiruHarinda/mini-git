import { decodeCommit, encodeCommit, type CommitData, type Signature } from "./commit.js";
import { foldIndexIntoTree, sortIndexEntries, type IndexEntry } from "./index-entries.js";
import { ObjectStore } from "./store.js";
import type { ObjectId, ObjectStorage, RefName } from "./storage/types.js";
import { decodeTree, encodeTree, sortTreeEntries, type TreeEntry } from "./tree.js";

const DEFAULT_BRANCH: RefName = "refs/heads/main";
const DEFAULT_SIGNATURE_NAME = "mini-git";
const DEFAULT_SIGNATURE_EMAIL = "mini-git@localhost";

export interface CommitOptions {
  message: string;
  author?: Partial<Signature>;
  committer?: Partial<Signature>;
}

export interface CommitResult {
  id: ObjectId;
  /** Trees and the Commit itself that were newly written, in creation order. Blobs are not included — they were created (or reused) at `add` time. */
  createdObjects: ObjectId[];
}

export interface LogEntry {
  id: ObjectId;
  message: string;
  author: Signature;
  committer: Signature;
  parents: ObjectId[];
}

/**
 * The single public surface composing the engine's modules. Everything
 * outside the engine goes through this.
 */
export class Repository {
  private readonly storage: ObjectStorage;
  private readonly store: ObjectStore;
  private index = new Map<string, ObjectId>();

  constructor(storage: ObjectStorage) {
    this.storage = storage;
    this.store = new ObjectStore(storage);
  }

  async init(defaultBranch: RefName = DEFAULT_BRANCH): Promise<void> {
    await this.storage.writeHead(defaultBranch);
  }

  // --- Objects -------------------------------------------------------

  async writeBlob(content: Uint8Array): Promise<ObjectId> {
    const { id } = await this.store.writeObject("blob", content);
    return id;
  }

  async readBlob(id: ObjectId): Promise<Uint8Array | null> {
    const obj = await this.store.readObject(id);
    if (obj === null) return null;
    if (obj.type !== "blob") {
      throw new Error(`object ${id} is a ${obj.type}, not a blob`);
    }
    return obj.content;
  }

  /** Entries need not be pre-sorted; this sorts them the way git's tree entry order requires. */
  async writeTree(entries: readonly TreeEntry[]): Promise<ObjectId> {
    const { id } = await this.writeTreeInternal(entries);
    return id;
  }

  private async writeTreeInternal(entries: readonly TreeEntry[]) {
    const sorted = sortTreeEntries(entries);
    return this.store.writeObject("tree", encodeTree(sorted));
  }

  async readTree(id: ObjectId): Promise<TreeEntry[] | null> {
    const obj = await this.store.readObject(id);
    if (obj === null) return null;
    if (obj.type !== "tree") {
      throw new Error(`object ${id} is a ${obj.type}, not a tree`);
    }
    return decodeTree(obj.content);
  }

  async writeCommit(data: CommitData): Promise<ObjectId> {
    const { id } = await this.store.writeObject("commit", encodeCommit(data));
    return id;
  }

  async readCommit(id: ObjectId): Promise<CommitData | null> {
    const obj = await this.store.readObject(id);
    if (obj === null) return null;
    if (obj.type !== "commit") {
      throw new Error(`object ${id} is a ${obj.type}, not a commit`);
    }
    return decodeCommit(obj.content);
  }

  // --- Index -----------------------------------------------------------

  /** Records the given content — the Working Tree content at this moment — into the Index at `path`. */
  async add(path: string, content: Uint8Array): Promise<{ id: ObjectId; created: boolean }> {
    const result = await this.store.writeObject("blob", content);
    this.index.set(path, result.id);
    return result;
  }

  /** Removes `path` from the Index. Never touches the Working Tree. */
  unstage(path: string): void {
    this.index.delete(path);
  }

  /** The Index as it actually is: a flat, sorted list of paths to Blob IDs. */
  readIndex(): IndexEntry[] {
    return sortIndexEntries([...this.index.entries()].map(([path, id]) => ({ path, id })));
  }

  /**
   * Replaces the Index wholesale, trusting the given (path, Object ID)
   * pairs without rehashing content. The engine keeps no Index persistence
   * of its own (ADR 0002: no path or fs call belongs here), so a caller
   * that persists Index state across process invocations — the CLI — uses
   * this to rehydrate it at startup.
   */
  restoreIndex(entries: readonly IndexEntry[]): void {
    this.index = new Map(entries.map((e) => [e.path, e.id]));
  }

  // --- Commits and history ----------------------------------------------

  async currentBranch(): Promise<RefName> {
    return this.storage.readHead();
  }

  async headCommitId(): Promise<ObjectId | undefined> {
    const headRef = await this.storage.readHead();
    const refs = await this.storage.listRefs();
    return refs.get(headRef);
  }

  async commit(options: CommitOptions): Promise<CommitResult> {
    if (this.index.size === 0) {
      throw new Error("nothing to commit: the Index is empty");
    }

    const createdObjects: ObjectId[] = [];
    const { id: treeId } = await foldIndexIntoTree(this.readIndex(), async (entries) => {
      const result = await this.writeTreeInternal(entries);
      if (result.created) createdObjects.push(result.id);
      return result;
    });

    const headRef = await this.storage.readHead();
    const parentId = await this.headCommitId();
    const parents = parentId ? [parentId] : [];

    const now = Math.floor(Date.now() / 1000);
    const author: Signature = {
      name: DEFAULT_SIGNATURE_NAME,
      email: DEFAULT_SIGNATURE_EMAIL,
      timestamp: now,
      timezoneOffsetMinutes: 0,
      ...options.author,
    };
    const committer: Signature = {
      name: DEFAULT_SIGNATURE_NAME,
      email: DEFAULT_SIGNATURE_EMAIL,
      timestamp: now,
      timezoneOffsetMinutes: 0,
      ...options.committer,
    };

    const data: CommitData = { tree: treeId, parents, author, committer, message: options.message };
    const { id, created } = await this.store.writeObject("commit", encodeCommit(data));
    if (created) createdObjects.push(id);

    await this.storage.setRef(headRef, id);

    return { id, createdObjects };
  }

  /** Walks Parents from HEAD, most recent first. Follows the first Parent only — sufficient until Merge Commits exist. */
  async log(): Promise<LogEntry[]> {
    let currentId = await this.headCommitId();
    const entries: LogEntry[] = [];
    while (currentId) {
      const commit = await this.readCommit(currentId);
      if (!commit) break;
      entries.push({ id: currentId, message: commit.message, author: commit.author, committer: commit.committer, parents: commit.parents });
      currentId = commit.parents[0];
    }
    return entries;
  }
}
