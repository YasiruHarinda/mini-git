import { afterEach, describe, expect, it } from "vitest";
import { join } from "node:path";
import { Repository } from "../src/engine/repository.js";
import { MemoryStorage } from "../src/engine/storage/memory.js";
import { FilesystemStorage } from "../src/engine/storage/filesystem.js";
import type { CommitData, Signature } from "../src/engine/commit.js";
import type { ObjectStorage } from "../src/engine/storage/types.js";
import { makeTmpDir, removeTmpDir } from "./support/tmpdir.js";

interface Adapter {
  name: string;
  make: () => Promise<ObjectStorage>;
  cleanup: () => Promise<void>;
}

async function adapters(): Promise<Adapter[]> {
  const tmpDirs: string[] = [];
  return [
    { name: "in-memory adapter", make: async () => new MemoryStorage(), cleanup: async () => {} },
    {
      name: "filesystem adapter",
      make: async () => {
        const dir = await makeTmpDir();
        tmpDirs.push(dir);
        return new FilesystemStorage(join(dir, ".git"));
      },
      cleanup: async () => {
        await Promise.all(tmpDirs.map(removeTmpDir));
      },
    },
  ];
}

const author: Signature = {
  name: "Test Author",
  email: "author@example.com",
  timestamp: 1_700_000_000,
  timezoneOffsetMinutes: 0,
};

describe("Repository: Tree and Commit storage, run against every adapter", async () => {
  for (const adapter of await adapters()) {
    describe(adapter.name, () => {
      afterEach(async () => {
        await adapter.cleanup();
      });

      it("round-trips a nested Tree: Tree containing a Tree containing a Blob", async () => {
        const repo = new Repository(await adapter.make());
        const blobId = await repo.writeBlob(new TextEncoder().encode("deep content"));
        const innerTreeId = await repo.writeTree([{ mode: "100644", name: "main.js", id: blobId }]);
        const outerTreeId = await repo.writeTree([{ mode: "40000", name: "src", id: innerTreeId }]);

        const outer = await repo.readTree(outerTreeId);
        expect(outer).toEqual([{ mode: "40000", name: "src", id: innerTreeId }]);
        const inner = await repo.readTree(innerTreeId);
        expect(inner).toEqual([{ mode: "100644", name: "main.js", id: blobId }]);
      });

      it("round-trips an empty Tree", async () => {
        const repo = new Repository(await adapter.make());
        const id = await repo.writeTree([]);
        expect(await repo.readTree(id)).toEqual([]);
      });

      it("sorts entries itself so callers do not have to pre-sort", async () => {
        const repo = new Repository(await adapter.make());
        const blobId = await repo.writeBlob(new TextEncoder().encode("x"));
        const unsorted = [
          { mode: "100644" as const, name: "b.txt", id: blobId },
          { mode: "100644" as const, name: "a.txt", id: blobId },
        ];
        const id = await repo.writeTree(unsorted);
        const readBack = await repo.readTree(id);
        expect(readBack?.map((e) => e.name)).toEqual(["a.txt", "b.txt"]);
      });

      it("round-trips a root Commit with no Parents", async () => {
        const repo = new Repository(await adapter.make());
        const treeId = await repo.writeTree([]);
        const data: CommitData = { tree: treeId, parents: [], author, committer: author, message: "root" };
        const id = await repo.writeCommit(data);
        expect(await repo.readCommit(id)).toEqual(data);
      });

      it("round-trips a Merge Commit with two Parents", async () => {
        const repo = new Repository(await adapter.make());
        const treeId = await repo.writeTree([]);
        const p1 = await repo.writeCommit({ tree: treeId, parents: [], author, committer: author, message: "p1" });
        const p2 = await repo.writeCommit({ tree: treeId, parents: [], author, committer: author, message: "p2" });
        const data: CommitData = {
          tree: treeId,
          parents: [p1, p2],
          author,
          committer: author,
          message: "merge",
        };
        const id = await repo.writeCommit(data);
        expect(await repo.readCommit(id)).toEqual(data);
      });

      it("reads a Tree and rejects reading it back as a Blob", async () => {
        const repo = new Repository(await adapter.make());
        const treeId = await repo.writeTree([]);
        await expect(repo.readBlob(treeId)).rejects.toThrow();
      });
    });
  }
});
