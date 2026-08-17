import type { ObjectId, ObjectStorage, RefName } from "./types.js";

const DEFAULT_HEAD: RefName = "refs/heads/main";

/** In-memory ObjectStorage, backed by browser storage in the deployed demo. */
export class MemoryStorage implements ObjectStorage {
  private readonly objects = new Map<ObjectId, Uint8Array>();
  private readonly refs = new Map<RefName, ObjectId>();
  private head: RefName = DEFAULT_HEAD;

  async read(id: ObjectId): Promise<Uint8Array | null> {
    return this.objects.get(id) ?? null;
  }

  async write(id: ObjectId, bytes: Uint8Array): Promise<void> {
    this.objects.set(id, bytes);
  }

  async has(id: ObjectId): Promise<boolean> {
    return this.objects.has(id);
  }

  /** Total Objects stored. Not part of ObjectStorage — a test-only window into this adapter, for asserting that an operation created no new Objects. */
  get objectCount(): number {
    return this.objects.size;
  }

  async listRefs(): Promise<Map<RefName, ObjectId>> {
    return new Map(this.refs);
  }

  async setRef(name: RefName, id: ObjectId): Promise<void> {
    this.refs.set(name, id);
  }

  async deleteRef(name: RefName): Promise<void> {
    this.refs.delete(name);
  }

  async readHead(): Promise<RefName> {
    return this.head;
  }

  async writeHead(name: RefName): Promise<void> {
    this.head = name;
  }
}
