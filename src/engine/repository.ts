import { encodeCommit, decodeCommit, type CommitData } from "./commit.js";
import { ObjectStore } from "./store.js";
import type { ObjectId, ObjectStorage } from "./storage/types.js";
import { decodeTree, encodeTree, sortTreeEntries, type TreeEntry } from "./tree.js";

/**
 * The single public surface composing the engine's modules. Everything
 * outside the engine goes through this.
 */
export class Repository {
  private readonly store: ObjectStore;

  constructor(storage: ObjectStorage) {
    this.store = new ObjectStore(storage);
  }

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
    const sorted = sortTreeEntries(entries);
    const { id } = await this.store.writeObject("tree", encodeTree(sorted));
    return id;
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
}
