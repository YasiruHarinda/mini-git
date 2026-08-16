import { ObjectStore } from "./store.js";
import type { ObjectId, ObjectStorage } from "./storage/types.js";

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
}
