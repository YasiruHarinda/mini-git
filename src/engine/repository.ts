import { decodeCommit, encodeCommit, type CommitData, type Signature } from "./commit.js";
import { hashObject } from "./codec.js";
import { diffLines, type Hunk } from "./diff.js";
import { foldIndexIntoTree, sortIndexEntries, type IndexEntry } from "./index-entries.js";
import { ObjectStore } from "./store.js";
import type { ObjectId, ObjectStorage, RefName } from "./storage/types.js";
import { decodeTree, encodeTree, sortTreeEntries, type TreeEntry } from "./tree.js";

const DEFAULT_BRANCH: RefName = "refs/heads/main";
const DEFAULT_SIGNATURE_NAME = "mini-git";
const DEFAULT_SIGNATURE_EMAIL = "mini-git@localhost";
const HEADS_PREFIX = "refs/heads/";

function branchRef(name: string): RefName {
  return name.startsWith("refs/") ? name : `${HEADS_PREFIX}${name}`;
}

function branchShortName(ref: RefName): string {
  return ref.startsWith(HEADS_PREFIX) ? ref.slice(HEADS_PREFIX.length) : ref;
}

export interface BranchInfo {
  name: string;
  id: ObjectId;
  /** Whether this is the Branch HEAD currently points at. */
  current: boolean;
}

/** Reads a path's current Working Tree content, or undefined if the path has no file there. The engine never touches a filesystem itself (ADR 0002); this is how checkout asks the caller for what it needs. */
export type WorkingTreeReader = (path: string) => Promise<Uint8Array | undefined>;

export interface CheckoutResult {
  /** Paths whose content in the Working Tree should become this content. */
  writes: { path: string; content: Uint8Array }[];
  /** Paths that should be removed from the Working Tree. */
  removes: string[];
}

/** Thrown when checkout would overwrite uncommitted Working Tree changes. Names every offending path. */
export class CheckoutConflictError extends Error {
  readonly paths: string[];

  constructor(paths: string[]) {
    super(`checkout would overwrite uncommitted changes in: ${paths.join(", ")}`);
    this.name = "CheckoutConflictError";
    this.paths = paths;
  }
}

export type FileChangeType = "added" | "removed" | "modified";

export interface FileDiff {
  path: string;
  type: FileChangeType;
  oldId?: ObjectId;
  newId?: ObjectId;
  hunks: Hunk[];
}

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

  // --- Branches and checkout ---------------------------------------------

  /** Creates a new Branch at the current Commit. Creates zero new Objects — a Branch is a pointer, not a container. */
  async branch(name: string): Promise<RefName> {
    const commitId = await this.headCommitId();
    if (commitId === undefined) {
      throw new Error(`cannot create branch "${name}": HEAD has no Commits yet`);
    }
    const ref = branchRef(name);
    const refs = await this.storage.listRefs();
    if (refs.has(ref)) {
      throw new Error(`branch "${name}" already exists`);
    }
    await this.storage.setRef(ref, commitId);
    return ref;
  }

  /** Lists Branches, marking which one HEAD currently points at. */
  async listBranches(): Promise<BranchInfo[]> {
    const [refs, headRef] = await Promise.all([this.storage.listRefs(), this.storage.readHead()]);
    const branches: BranchInfo[] = [];
    for (const [ref, id] of refs) {
      if (!ref.startsWith(HEADS_PREFIX)) continue;
      branches.push({ name: branchShortName(ref), id, current: ref === headRef });
    }
    return branches.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  }

  /** Removes the Branch's Ref. Destroys no Objects — they remain reachable by Object ID even once unnamed. */
  async deleteBranch(name: string): Promise<void> {
    const ref = branchRef(name);
    const [refs, headRef] = await Promise.all([this.storage.listRefs(), this.storage.readHead()]);
    if (!refs.has(ref)) {
      throw new Error(`branch "${name}" does not exist`);
    }
    if (ref === headRef) {
      throw new Error(`cannot delete branch "${name}": it is the current branch`);
    }
    await this.storage.deleteRef(ref);
  }

  /** Flattens a Tree into full paths mapped to Blob Object IDs, walking sub-Trees recursively. */
  private async flattenTree(treeId: ObjectId | undefined, prefix = ""): Promise<Map<string, ObjectId>> {
    const result = new Map<string, ObjectId>();
    if (treeId === undefined) return result;
    const entries = await this.readTree(treeId);
    if (!entries) return result;
    for (const entry of entries) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.mode === "40000") {
        for (const [subPath, id] of await this.flattenTree(entry.id, path)) {
          result.set(subPath, id);
        }
      } else {
        result.set(path, entry.id);
      }
    }
    return result;
  }

  private async commitPaths(commitId: ObjectId | undefined): Promise<Map<string, ObjectId>> {
    if (commitId === undefined) return new Map();
    const commit = await this.readCommit(commitId);
    if (!commit) return new Map();
    return this.flattenTree(commit.tree);
  }

  /**
   * Moves HEAD to the given Branch and reports how the Working Tree must
   * change to match it. The engine computes the plan; the caller (CLI or
   * web shell) is the one that actually reads and writes files (ADR 0002),
   * fetching current content through `readWorkingTree` only for the paths
   * the plan turns out to need.
   *
   * Refuses — and moves nothing — when a path the switch would touch
   * currently differs from its content in the old Commit: that is an
   * uncommitted change that checkout would otherwise silently discard.
   * Paths whose content is identical in both Commits are left alone even
   * if they are locally modified, since checkout does not touch them.
   */
  async checkout(name: string, readWorkingTree: WorkingTreeReader): Promise<CheckoutResult> {
    const targetRef = branchRef(name);
    const refs = await this.storage.listRefs();
    const targetCommitId = refs.get(targetRef);
    if (targetCommitId === undefined) {
      throw new Error(`branch "${name}" does not exist`);
    }

    const oldCommitId = await this.headCommitId();
    const [oldPaths, newPaths] = await Promise.all([
      this.commitPaths(oldCommitId),
      this.commitPaths(targetCommitId),
    ]);

    const allPaths = new Set([...oldPaths.keys(), ...newPaths.keys()]);
    const conflicts: string[] = [];
    const writes: { path: string; content: Uint8Array }[] = [];
    const removes: string[] = [];

    for (const path of allPaths) {
      const oldId = oldPaths.get(path);
      const newId = newPaths.get(path);
      if (newId === oldId) continue; // identical in both Commits: never touched, regardless of local edits

      const working = await readWorkingTree(path);
      const workingId = working === undefined ? undefined : hashObject("blob", working);
      if (workingId !== oldId) {
        conflicts.push(path);
        continue;
      }

      if (newId === undefined) {
        removes.push(path);
      } else {
        writes.push({ path, content: (await this.readBlob(newId))! });
      }
    }

    if (conflicts.length > 0) {
      throw new CheckoutConflictError(conflicts.sort());
    }

    await this.storage.writeHead(targetRef);
    return { writes, removes };
  }

  // --- Diff ---------------------------------------------------------------

  /**
   * Resolves a Branch name or literal Object ID to a Commit's Object ID.
   * Convenience for callers (the CLI) that let someone name either.
   */
  async resolveCommitish(name: string): Promise<ObjectId> {
    const refs = await this.storage.listRefs();
    const branchId = refs.get(branchRef(name));
    if (branchId !== undefined) return branchId;
    if ((await this.readCommit(name)) !== null) return name;
    throw new Error(`"${name}" is not a Branch or a Commit`);
  }

  /** What changed between two Commits, at line level. Computed on demand — no Object is created or read beyond what's needed to describe the change. */
  async diff(oldCommitId: ObjectId, newCommitId: ObjectId): Promise<FileDiff[]> {
    const [oldCommit, newCommit] = await Promise.all([this.readCommit(oldCommitId), this.readCommit(newCommitId)]);
    if (!oldCommit) throw new Error(`commit ${oldCommitId} not found`);
    if (!newCommit) throw new Error(`commit ${newCommitId} not found`);

    const results = await this.diffTrees(oldCommit.tree, newCommit.tree, "");
    return results.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  }

  /**
   * Recursively compares two Trees. A sub-Tree whose Object ID is identical
   * on both sides is never read — Structural Sharing means nothing beneath
   * it can differ, so there is nothing to walk into.
   */
  private async diffTrees(oldTreeId: ObjectId | undefined, newTreeId: ObjectId | undefined, prefix: string): Promise<FileDiff[]> {
    if (oldTreeId === newTreeId) return [];

    const [oldEntries, newEntries] = await Promise.all([
      oldTreeId !== undefined ? this.readTree(oldTreeId) : Promise.resolve([]),
      newTreeId !== undefined ? this.readTree(newTreeId) : Promise.resolve([]),
    ]);
    const oldByName = new Map((oldEntries ?? []).map((e) => [e.name, e]));
    const newByName = new Map((newEntries ?? []).map((e) => [e.name, e]));

    const results: FileDiff[] = [];
    for (const name of new Set([...oldByName.keys(), ...newByName.keys()])) {
      const oldEntry = oldByName.get(name);
      const newEntry = newByName.get(name);
      if (oldEntry?.id === newEntry?.id) continue;

      const path = prefix ? `${prefix}/${name}` : name;
      const oldIsTree = oldEntry === undefined || oldEntry.mode === "40000";
      const newIsTree = newEntry === undefined || newEntry.mode === "40000";
      if (oldIsTree && newIsTree) {
        results.push(...(await this.diffTrees(oldEntry?.id, newEntry?.id, path)));
      } else {
        results.push(await this.diffBlobEntry(path, oldEntry, newEntry));
      }
    }
    return results;
  }

  private async diffBlobEntry(path: string, oldEntry?: TreeEntry, newEntry?: TreeEntry): Promise<FileDiff> {
    const type: FileChangeType = oldEntry === undefined ? "added" : newEntry === undefined ? "removed" : "modified";
    const [oldContent, newContent] = await Promise.all([
      oldEntry ? this.readBlob(oldEntry.id) : Promise.resolve(null),
      newEntry ? this.readBlob(newEntry.id) : Promise.resolve(null),
    ]);
    const decoder = new TextDecoder();
    const hunks = diffLines(oldContent ? decoder.decode(oldContent) : "", newContent ? decoder.decode(newContent) : "");
    return { path, type, oldId: oldEntry?.id, newId: newEntry?.id, hunks };
  }
}
