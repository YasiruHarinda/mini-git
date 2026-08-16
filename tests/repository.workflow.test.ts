import { describe, expect, it } from "vitest";
import { Repository } from "../src/engine/repository.js";
import { MemoryStorage } from "../src/engine/storage/memory.js";

const enc = (s: string) => new TextEncoder().encode(s);

describe("Repository: init", () => {
  it("creates an empty Repository with HEAD pointing at a Branch with no Commits yet", async () => {
    const repo = new Repository(new MemoryStorage());
    await repo.init();
    expect(await repo.currentBranch()).toBe("refs/heads/main");
    expect(await repo.headCommitId()).toBeUndefined();
    expect(await repo.log()).toEqual([]);
  });
});

describe("Repository: add and unstage", () => {
  it("stages the content given, not a live reference to the caller's bytes", async () => {
    const repo = new Repository(new MemoryStorage());
    await repo.init();
    const bytes = enc("v1");
    await repo.add("a.txt", bytes);
    bytes[0] = 0; // mutate the caller's buffer after staging
    const [entry] = repo.readIndex();
    const staged = await repo.readBlob(entry!.id);
    expect(new TextDecoder().decode(staged!)).toBe("v1");
  });

  it("staging the same path again with new content updates the Index, leaving history untouched until commit", async () => {
    const repo = new Repository(new MemoryStorage());
    await repo.init();
    await repo.add("a.txt", enc("v1"));
    await repo.add("a.txt", enc("v2"));
    const [entry] = repo.readIndex();
    const staged = await repo.readBlob(entry!.id);
    expect(new TextDecoder().decode(staged!)).toBe("v2");
  });

  it("readIndex returns a flat, sorted list of paths to Blob IDs", async () => {
    const repo = new Repository(new MemoryStorage());
    await repo.init();
    await repo.add("src/b.txt", enc("b"));
    await repo.add("a.txt", enc("a"));
    expect(repo.readIndex().map((e) => e.path)).toEqual(["a.txt", "src/b.txt"]);
  });

  it("unstage removes a path from the Index without touching the Working Tree", async () => {
    const repo = new Repository(new MemoryStorage());
    await repo.init();
    const { id } = await repo.add("a.txt", enc("a"));
    repo.unstage("a.txt");
    expect(repo.readIndex()).toEqual([]);
    expect(await repo.readBlob(id)).not.toBeNull(); // the Blob itself is untouched
  });
});

describe("Repository: commit", () => {
  it("refuses to commit an empty Index, saying why", async () => {
    const repo = new Repository(new MemoryStorage());
    await repo.init();
    await expect(repo.commit({ message: "nothing staged" })).rejects.toThrow(/empty/i);
  });

  it("builds nested Trees from the flat Index and advances the current Branch", async () => {
    const repo = new Repository(new MemoryStorage());
    await repo.init();
    await repo.add("a.txt", enc("a"));
    await repo.add("src/b.txt", enc("b"));
    const result = await repo.commit({ message: "first commit" });

    expect(await repo.headCommitId()).toBe(result.id);
    const commit = await repo.readCommit(result.id);
    expect(commit?.parents).toEqual([]);
    const tree = await repo.readTree(commit!.tree);
    expect(tree?.map((e) => e.name).sort()).toEqual(["a.txt", "src"]);
    const srcEntry = tree!.find((e) => e.name === "src")!;
    const srcTree = await repo.readTree(srcEntry.id);
    expect(srcTree?.[0]?.name).toBe("b.txt");
  });

  it("a second commit has the first as its Parent", async () => {
    const repo = new Repository(new MemoryStorage());
    await repo.init();
    await repo.add("a.txt", enc("a"));
    const first = await repo.commit({ message: "first" });
    await repo.add("a.txt", enc("a2"));
    const second = await repo.commit({ message: "second" });
    const commit = await repo.readCommit(second.id);
    expect(commit?.parents).toEqual([first.id]);
  });

  it("two identical files at different paths resolve to a single Blob", async () => {
    const repo = new Repository(new MemoryStorage());
    await repo.init();
    const a = await repo.add("one/copy.txt", enc("identical"));
    const b = await repo.add("two/copy.txt", enc("identical"));
    expect(a.id).toBe(b.id);
    expect(b.created).toBe(false);
  });

  it("changing one file three directories deep creates exactly the Objects along that path and reuses the rest", async () => {
    const repo = new Repository(new MemoryStorage());
    await repo.init();
    await repo.add("a.txt", enc("a"));
    await repo.add("src/b.txt", enc("b"));
    await repo.add("src/deep/dir/c.txt", enc("c-v1"));
    await repo.add("other/unrelated.txt", enc("unrelated"));
    const first = await repo.commit({ message: "first" });
    const firstTree = await repo.readTree((await repo.readCommit(first.id))!.tree);
    const otherTreeIdBefore = firstTree!.find((e) => e.name === "other")!.id;

    const changed = await repo.add("src/deep/dir/c.txt", enc("c-v2"));
    expect(changed.created).toBe(true);

    const second = await repo.commit({ message: "second" });
    // New: blob(c.txt) is created separately by add(); commit() creates the
    // Tree for dir, deep, src and the root, plus the Commit itself — 5 Objects.
    expect(second.createdObjects.length).toBe(5);

    const secondTree = await repo.readTree((await repo.readCommit(second.id))!.tree);
    const otherTreeIdAfter = secondTree!.find((e) => e.name === "other")!.id;
    expect(otherTreeIdAfter).toBe(otherTreeIdBefore); // untouched subtree reused, same Object ID
  });
});

describe("Repository: log", () => {
  it("walks Parents from HEAD, most recent first, reporting message, Object ID and time", async () => {
    const repo = new Repository(new MemoryStorage());
    await repo.init();
    await repo.add("a.txt", enc("a"));
    const first = await repo.commit({ message: "first" });
    await repo.add("a.txt", enc("a2"));
    const second = await repo.commit({ message: "second" });

    const log = await repo.log();
    expect(log.map((e) => e.id)).toEqual([second.id, first.id]);
    expect(log.map((e) => e.message)).toEqual(["second", "first"]);
    expect(log[0]!.author.timestamp).toBeGreaterThan(0);
  });
});
