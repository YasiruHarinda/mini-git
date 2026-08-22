import { describe, expect, it } from "vitest";
import { Repository } from "../src/engine/repository.js";
import { MemoryStorage } from "../src/engine/storage/memory.js";

const enc = (s: string) => new TextEncoder().encode(s);

describe("Repository: new versus reused Objects", () => {
  it("counts every Object of a first Commit as created", async () => {
    const repo = new Repository(new MemoryStorage());
    await repo.init();
    await repo.add("a.txt", enc("one"));
    const commit = await repo.commit({ message: "first" });

    const operation = repo.lastOperation()!;
    expect(operation.commitId).toBe(commit.id);
    // One Blob, one root Tree, one Commit — nothing existed to reuse.
    expect(operation.created).toHaveLength(3);
    expect(repo.objectOrigin(commit.id)).toBe("created");
  });

  it("creates Objects only along the path from a changed deep file to the root", async () => {
    const repo = new Repository(new MemoryStorage());
    await repo.init();
    for (const path of ["src/a/b/deep.txt", "src/a/other.txt", "src/sibling.txt", "top.txt"]) {
      await repo.add(path, enc(`${path} v1`));
    }
    const first = await repo.commit({ message: "first" });
    const firstCount = repo.lastOperation()!.created.length;

    await repo.add("src/a/b/deep.txt", enc("changed"));
    const second = await repo.commit({ message: "second" });

    // Blob + src/a/b + src/a + src + root + Commit = six, however many
    // Objects the snapshot as a whole contains.
    const created = new Set(repo.lastOperation()!.created);
    expect(created.size).toBe(6);
    expect(created.has(second.id)).toBe(true);

    const entries = await repo.readCommitEntries(second.id);
    const untouched = entries.filter((e) => e.path !== "src/a/b/deep.txt");
    expect(untouched.length).toBeGreaterThan(0);
    for (const entry of untouched) {
      expect(repo.objectOrigin(entry.id)).toBe("reused");
    }

    // Everything the previous Commit created is now history, not new.
    expect(repo.objectOrigin(first.id)).toBe("reused");
    expect(firstCount).toBeGreaterThan(created.size);
  });

  it("reports a Commit that changes nothing as creating only itself", async () => {
    const repo = new Repository(new MemoryStorage());
    await repo.init();
    await repo.add("a.txt", enc("one"));
    await repo.commit({ message: "first" });

    await repo.add("a.txt", enc("one")); // same content: the Blob is already there
    const again = await repo.commit({ message: "second, identical tree" });

    expect(repo.lastOperation()!.created).toEqual([again.id]);
  });

  it("treats an Object never written as reused rather than created", async () => {
    const repo = new Repository(new MemoryStorage());
    await repo.init();
    await repo.add("a.txt", enc("one"));
    await repo.commit({ message: "first" });

    expect(repo.objectOrigin("0".repeat(40))).toBe("reused");
  });

  it("has no last operation before anything is committed", async () => {
    const repo = new Repository(new MemoryStorage());
    await repo.init();
    expect(repo.lastOperation()).toBeUndefined();
  });
});

describe("Repository: dedup statistics", () => {
  it("counts identical files at two paths as one Blob", async () => {
    const repo = new Repository(new MemoryStorage());
    await repo.init();
    await repo.add("docs/notice.txt", enc("same bytes"));
    await repo.add("legal/notice.txt", enc("same bytes"));
    await repo.commit({ message: "one Blob, two paths" });

    const stats = await repo.objectStats();
    expect(stats.fileVersions).toBe(2);
    expect(stats.uniqueBlobs).toBe(1);
    expect(stats.reusedVersions).toBe(1);
    expect(stats.savedProportion).toBeCloseTo(0.5);
  });

  it("counts a file carried unchanged through Commits once", async () => {
    const repo = new Repository(new MemoryStorage());
    await repo.init();
    await repo.add("stable.txt", enc("never changes"));
    await repo.add("moving.txt", enc("v1"));
    await repo.commit({ message: "first" });
    await repo.add("moving.txt", enc("v2"));
    await repo.commit({ message: "second" });
    await repo.add("moving.txt", enc("v3"));
    await repo.commit({ message: "third" });

    const stats = await repo.objectStats();
    expect(stats.fileVersions).toBe(6); // two paths across three Commits
    expect(stats.uniqueBlobs).toBe(4); // stable.txt once, moving.txt three times
    expect(stats.reusedVersions).toBe(2);
  });

  it("reports zeroes, not a division by zero, on an empty Repository", async () => {
    const repo = new Repository(new MemoryStorage());
    await repo.init();
    expect(await repo.objectStats()).toEqual({
      uniqueBlobs: 0,
      fileVersions: 0,
      reusedVersions: 0,
      savedProportion: 0,
    });
  });

  it("counts Commits reachable from any Branch, not only from HEAD", async () => {
    const storage = new MemoryStorage();
    const repo = new Repository(storage);
    await repo.init();
    await repo.add("a.txt", enc("base"));
    await repo.commit({ message: "base" });
    await repo.branch("feature");

    await storage.writeHead("refs/heads/feature");
    await repo.add("b.txt", enc("only on feature"));
    await repo.commit({ message: "on feature" });
    await storage.writeHead("refs/heads/main");

    const stats = await repo.objectStats();
    expect(stats.fileVersions).toBe(3); // a.txt on main, a.txt + b.txt on feature
    expect(stats.uniqueBlobs).toBe(2);
  });
});
