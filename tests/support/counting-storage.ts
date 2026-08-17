import type { ObjectId, ObjectStorage, RefName } from "../../src/engine/storage/types.js";

/** Wraps an ObjectStorage and counts read() calls per Object ID, so a test can assert a particular Object was never read — the payoff of the Structural Sharing shortcut. */
export class CountingStorage implements ObjectStorage {
  readonly readCounts = new Map<ObjectId, number>();

  constructor(private readonly inner: ObjectStorage) {}

  async read(id: ObjectId): Promise<Uint8Array | null> {
    this.readCounts.set(id, (this.readCounts.get(id) ?? 0) + 1);
    return this.inner.read(id);
  }

  write(id: ObjectId, bytes: Uint8Array): Promise<void> {
    return this.inner.write(id, bytes);
  }

  has(id: ObjectId): Promise<boolean> {
    return this.inner.has(id);
  }

  listRefs(): Promise<Map<RefName, ObjectId>> {
    return this.inner.listRefs();
  }

  setRef(name: RefName, id: ObjectId): Promise<void> {
    return this.inner.setRef(name, id);
  }

  deleteRef(name: RefName): Promise<void> {
    return this.inner.deleteRef(name);
  }

  readHead(): Promise<RefName> {
    return this.inner.readHead();
  }

  writeHead(name: RefName): Promise<void> {
    return this.inner.writeHead(name);
  }
}
