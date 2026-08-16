# 01 — A Blob written by the tool is readable by real git

**What to build:** Someone can store a file's contents as a Blob, and real git
— the one installed on the machine — can read that Blob back and agree with us
about its Object ID. This is the narrowest possible path through every layer of
the system, and it establishes the two properties everything else rests on: the
storage seam from ADR 0002, and the git-identical encoding from ADR 0001.

It also brings the project into existence: build tooling, test runner, and the
shape of the Repository API, even though only Blobs pass through it yet.

The storage interface, which encodes ADR 0002 more precisely than prose can:

```ts
interface ObjectStorage {
  read(id: ObjectId): Promise<Uint8Array | null>;
  write(id: ObjectId, bytes: Uint8Array): Promise<void>;
  has(id: ObjectId): Promise<boolean>;
  listRefs(): Promise<Map<RefName, ObjectId>>;
  setRef(name: RefName, id: ObjectId): Promise<void>;
  deleteRef(name: RefName): Promise<void>;
  readHead(): Promise<RefName>;
  writeHead(name: RefName): Promise<void>;
}
```

Refs are unused in this ticket but belong in the interface from the start, so
the seam does not have to be widened later.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] A Blob's Object ID matches `git hash-object` for the same content, asserted by an automated test rather than checked by hand
- [ ] The same engine code runs against an in-memory adapter and a filesystem adapter, selected by the caller
- [ ] No path, no filesystem call and no browser API appears in engine code — the seam holds
- [ ] The filesystem adapter writes zlib-compressed loose objects in git's directory layout, and `git cat-file -p` prints back the original content
- [ ] An empty Blob and a Blob whose content ends without a trailing newline both round-trip correctly
- [ ] Differential tests skip with a clear message when git is not present, rather than failing
- [ ] The test suite runs from a single command and is green
