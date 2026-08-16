import { afterEach, describe, expect, it } from "vitest";
import { join } from "node:path";
import { Repository } from "../src/engine/repository.js";
import { MemoryStorage } from "../src/engine/storage/memory.js";
import { FilesystemStorage } from "../src/engine/storage/filesystem.js";
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
    {
      name: "in-memory adapter",
      make: async () => new MemoryStorage(),
      cleanup: async () => {},
    },
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

describe("Repository: Blob storage, run against every adapter", async () => {
  for (const adapter of await adapters()) {
    describe(adapter.name, () => {
      afterEach(async () => {
        await adapter.cleanup();
      });

      it("writes a Blob and reads its content back by Object ID", async () => {
        const repo = new Repository(await adapter.make());
        const content = new TextEncoder().encode("hello world");
        const id = await repo.writeBlob(content);
        const readBack = await repo.readBlob(id);
        expect(readBack).not.toBeNull();
        expect(new TextDecoder().decode(readBack!)).toBe("hello world");
      });

      it("gives identical content the same Object ID (content addressing)", async () => {
        const repo = new Repository(await adapter.make());
        const idA = await repo.writeBlob(new TextEncoder().encode("same content"));
        const idB = await repo.writeBlob(new TextEncoder().encode("same content"));
        expect(idA).toBe(idB);
      });

      it("round-trips an empty Blob", async () => {
        const repo = new Repository(await adapter.make());
        const id = await repo.writeBlob(new Uint8Array(0));
        const readBack = await repo.readBlob(id);
        expect(readBack?.byteLength).toBe(0);
      });

      it("round-trips content with no trailing newline", async () => {
        const repo = new Repository(await adapter.make());
        const content = new TextEncoder().encode("no trailing newline");
        const id = await repo.writeBlob(content);
        const readBack = await repo.readBlob(id);
        expect(new TextDecoder().decode(readBack!)).toBe("no trailing newline");
      });

      it("returns null for an Object ID that was never written", async () => {
        const repo = new Repository(await adapter.make());
        const readBack = await repo.readBlob("0".repeat(40));
        expect(readBack).toBeNull();
      });
    });
  }
});
