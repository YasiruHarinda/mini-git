import { frameObject, hashObject, parseFrame, type ObjectType, type ParsedObject } from "./codec.js";
import type { ObjectId, ObjectStorage } from "./storage/types.js";

/**
 * The Object Store: reads and writes Objects by ID through the storage
 * interface. Append-only — an Object already present is never rewritten.
 */
export class ObjectStore {
  constructor(private readonly storage: ObjectStorage) {}

  /** Returns the id unchanged whether the object was newly written or already present. */
  async writeObject(type: ObjectType, content: Uint8Array): Promise<{ id: ObjectId; created: boolean }> {
    const id = hashObject(type, content);
    const created = !(await this.storage.has(id));
    if (created) {
      await this.storage.write(id, frameObject(type, content));
    }
    return { id, created };
  }

  async readObject(id: ObjectId): Promise<ParsedObject | null> {
    const frame = await this.storage.read(id);
    if (frame === null) return null;
    return parseFrame(frame);
  }

  async has(id: ObjectId): Promise<boolean> {
    return this.storage.has(id);
  }
}
