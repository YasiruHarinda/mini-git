/** A git-compatible SHA-1 object id: 40 lowercase hex characters. */
export type ObjectId = string;

/** A ref name, e.g. "refs/heads/main". */
export type RefName = string;

/**
 * The only way the engine touches persistence. No path, no filesystem call
 * and no browser API may appear above this line (ADR 0002).
 */
export interface ObjectStorage {
  read(id: ObjectId): Promise<Uint8Array | null>;
  write(id: ObjectId, bytes: Uint8Array): Promise<void>;
  has(id: ObjectId): Promise<boolean>;
  listRefs(): Promise<Map<RefName, ObjectId>>;
  setRef(name: RefName, id: ObjectId): Promise<void>;
  deleteRef(name: RefName): Promise<void>;
  readHead(): Promise<RefName>;
  writeHead(name: RefName): Promise<void>;
}
