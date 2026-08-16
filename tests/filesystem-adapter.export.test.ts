import { afterEach, describe, expect, it } from "vitest";
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { inflateSync } from "node:zlib";
import { Repository } from "../src/engine/repository.js";
import { FilesystemStorage } from "../src/engine/storage/filesystem.js";
import type { Signature } from "../src/engine/commit.js";
import { hasRealGit, runGit } from "./support/real-git.js";
import { makeTmpDir, removeTmpDir } from "./support/tmpdir.js";

describe("FilesystemStorage: git-compatible loose object layout", () => {
  let dir: string;

  afterEach(async () => {
    if (dir) await removeTmpDir(dir);
  });

  it("writes a zlib-compressed loose object at objects/<2 hex>/<38 hex>", async () => {
    dir = await makeTmpDir();
    const repo = new Repository(new FilesystemStorage(join(dir, ".git")));
    const content = new TextEncoder().encode("hello world");
    const id = await repo.writeBlob(content);

    const objectFile = join(dir, ".git", "objects", id.slice(0, 2), id.slice(2));
    const compressed = await readFile(objectFile);
    const raw = inflateSync(compressed);
    expect(new TextDecoder().decode(raw)).toBe(`blob ${content.byteLength}\0hello world`);
  });

  it.skipIf(!hasRealGit())("real git cat-file prints back the original content", async () => {
    dir = await makeTmpDir();
    const storage = new FilesystemStorage(join(dir, ".git"));
    await storage.writeHead("refs/heads/main");
    const repo = new Repository(storage);
    const id = await repo.writeBlob(new TextEncoder().encode("readable by real git"));

    const result = runGit(dir, ["cat-file", "-p", id]);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("readable by real git");
  });

  it.skipIf(!hasRealGit())("real git cat-file prints Trees and Commits written through this adapter", async () => {
    dir = await makeTmpDir();
    const storage = new FilesystemStorage(join(dir, ".git"));
    await storage.writeHead("refs/heads/main");
    const repo = new Repository(storage);

    const blobId = await repo.writeBlob(new TextEncoder().encode("file content"));
    const treeId = await repo.writeTree([{ mode: "100644", name: "file.txt", id: blobId }]);
    const author: Signature = {
      name: "Test Author",
      email: "author@example.com",
      timestamp: 1_700_000_000,
      timezoneOffsetMinutes: 0,
    };
    const commitId = await repo.writeCommit({
      tree: treeId,
      parents: [],
      author,
      committer: author,
      message: "first commit",
    });

    const treeOutput = runGit(dir, ["cat-file", "-p", treeId]);
    expect(treeOutput.status).toBe(0);
    expect(treeOutput.stdout).toContain("file.txt");

    const commitOutput = runGit(dir, ["cat-file", "-p", commitId]);
    expect(commitOutput.status).toBe(0);
    expect(commitOutput.stdout).toContain(`tree ${treeId}`);
    expect(commitOutput.stdout).toContain("first commit");
  });
});

if (!hasRealGit()) {
  console.warn("Skipping git cat-file differential test: real git not found on PATH.");
}
