import { describe, expect, it } from "vitest";
import { Repository } from "../src/engine/repository.js";
import { MemoryStorage } from "../src/engine/storage/memory.js";
import { CountingStorage } from "./support/counting-storage.js";

const enc = (s: string) => new TextEncoder().encode(s);

describe("Repository: diff", () => {
  it("reports changed paths, distinguishing added, removed and modified", async () => {
    const repo = new Repository(new MemoryStorage());
    await repo.init();
    await repo.add("a.txt", enc("1"));
    await repo.add("c.txt", enc("going away"));
    const first = await repo.commit({ message: "first" });

    repo.unstage("c.txt");
    await repo.add("a.txt", enc("2"));
    await repo.add("b.txt", enc("new file"));
    const second = await repo.commit({ message: "second" });

    const files = await repo.diff(first.id, second.id);
    expect(files.map((f) => [f.path, f.type])).toEqual([
      ["a.txt", "modified"],
      ["b.txt", "added"],
      ["c.txt", "removed"],
    ]);
  });

  it("gives line-level Hunks for a modified file, distinguishing added from removed lines", async () => {
    const repo = new Repository(new MemoryStorage());
    await repo.init();
    await repo.add("a.txt", enc("one\ntwo\nthree\n"));
    const first = await repo.commit({ message: "first" });
    await repo.add("a.txt", enc("one\nTWO\nthree\n"));
    const second = await repo.commit({ message: "second" });

    const [file] = await repo.diff(first.id, second.id);
    expect(file?.hunks).toEqual([{ oldStart: 2, removed: ["two"], newStart: 2, added: ["TWO"] }]);
  });

  it("represents whole-file addition and whole-file deletion correctly", async () => {
    const repo = new Repository(new MemoryStorage());
    await repo.init();
    await repo.add("keep.txt", enc("unchanged\n"));
    await repo.add("removed.txt", enc("bye\nbye\n"));
    const first = await repo.commit({ message: "first" });

    repo.unstage("removed.txt");
    await repo.add("added.txt", enc("hi\nhi\n"));
    const second = await repo.commit({ message: "second" });

    const files = await repo.diff(first.id, second.id);
    const added = files.find((f) => f.path === "added.txt")!;
    const removed = files.find((f) => f.path === "removed.txt")!;

    expect(added.type).toBe("added");
    expect(added.oldId).toBeUndefined();
    expect(added.hunks).toEqual([{ oldStart: 1, removed: [], newStart: 1, added: ["hi", "hi"] }]);

    expect(removed.type).toBe("removed");
    expect(removed.newId).toBeUndefined();
    expect(removed.hunks).toEqual([{ oldStart: 1, removed: ["bye", "bye"], newStart: 1, added: [] }]);
  });

  it("reports a file moved between directories as a removal plus an addition", async () => {
    const repo = new Repository(new MemoryStorage());
    await repo.init();
    await repo.add("old/file.txt", enc("same content"));
    const first = await repo.commit({ message: "first" });

    repo.unstage("old/file.txt");
    await repo.add("new/file.txt", enc("same content"));
    const second = await repo.commit({ message: "second" });

    const files = await repo.diff(first.id, second.id);
    expect(files.map((f) => [f.path, f.type]).sort()).toEqual([
      ["new/file.txt", "added"],
      ["old/file.txt", "removed"],
    ]);
  });

  it("produces an empty result diffing a Commit against itself", async () => {
    const repo = new Repository(new MemoryStorage());
    await repo.init();
    await repo.add("a.txt", enc("content"));
    const commit = await repo.commit({ message: "only" });

    expect(await repo.diff(commit.id, commit.id)).toEqual([]);
  });

  it("creates no Objects computing a diff", async () => {
    const storage = new MemoryStorage();
    const repo = new Repository(storage);
    await repo.init();
    await repo.add("a.txt", enc("1"));
    const first = await repo.commit({ message: "first" });
    await repo.add("a.txt", enc("2"));
    const second = await repo.commit({ message: "second" });

    const before = storage.objectCount;
    await repo.diff(first.id, second.id);
    expect(storage.objectCount).toBe(before);
  });

  it("never reads a sub-Tree (or anything beneath it) whose Object ID is unchanged between the two Commits", async () => {
    const memory = new MemoryStorage();
    const counting = new CountingStorage(memory);
    const repo = new Repository(counting);
    await repo.init();

    await repo.add("a.txt", enc("1"));
    await repo.add("src/deep/dir/unchanged.txt", enc("same"));
    const first = await repo.commit({ message: "first" });

    // Only a.txt changes; the src/deep/dir subtree — and the blob inside it — keep the same Object IDs.
    await repo.add("a.txt", enc("2"));
    const second = await repo.commit({ message: "second" });

    const firstTree = (await repo.readTree((await repo.readCommit(first.id))!.tree))!;
    const srcId = firstTree.find((e) => e.name === "src")!.id;
    const deepTree = (await repo.readTree(srcId))!;
    const deepId = deepTree.find((e) => e.name === "deep")!.id;
    const dirTree = (await repo.readTree(deepId))!;
    const dirId = dirTree.find((e) => e.name === "dir")!.id;
    const unchangedBlobId = (await repo.readTree(dirId))!.find((e) => e.name === "unchanged.txt")!.id;

    counting.readCounts.clear();
    const files = await repo.diff(first.id, second.id);

    expect(files.map((f) => f.path)).toEqual(["a.txt"]); // the unchanged subtree never surfaces as a change
    for (const untouchedId of [srcId, deepId, dirId, unchangedBlobId]) {
      expect(counting.readCounts.has(untouchedId)).toBe(false);
    }
  });
});
