import { describe, expect, it } from "vitest";
import { Repository } from "../src/engine/repository.js";
import { MemoryStorage } from "../src/engine/storage/memory.js";

const enc = (s: string) => new TextEncoder().encode(s);

describe("Repository: mergeBase", () => {
  it("finds the ancestor by walking Parents on a linear history", async () => {
    const repo = new Repository(new MemoryStorage());
    await repo.init();
    await repo.add("a.txt", enc("1"));
    const c1 = await repo.commit({ message: "c1" });
    await repo.add("a.txt", enc("2"));
    await repo.commit({ message: "c2" });
    await repo.add("a.txt", enc("3"));
    const c3 = await repo.commit({ message: "c3" });

    expect(await repo.mergeBase(c1.id, c3.id)).toBe(c1.id);
    expect(await repo.mergeBase(c3.id, c1.id)).toBe(c1.id); // order-independent
  });

  it("finds the shared ancestor of a diverged history", async () => {
    const storage = new MemoryStorage();
    const repo = new Repository(storage);
    await repo.init();
    await repo.add("a.txt", enc("base"));
    const base = await repo.commit({ message: "base" });
    await repo.branch("feature");

    await repo.add("a.txt", enc("main"));
    const mainTip = await repo.commit({ message: "on main" });

    await storage.writeHead("refs/heads/feature");
    await repo.add("a.txt", enc("feature"));
    const featureTip = await repo.commit({ message: "on feature" });

    expect(await repo.mergeBase(mainTip.id, featureTip.id)).toBe(base.id);
  });

  it("is correct once history already contains a Merge Commit", async () => {
    const storage = new MemoryStorage();
    const repo = new Repository(storage);
    await repo.init();
    await repo.add("a.txt", enc("base"));
    await repo.commit({ message: "base" });
    await repo.branch("side");

    await repo.add("a.txt", enc("main-1"));
    const mainTip = await repo.commit({ message: "main-1" });

    await storage.writeHead("refs/heads/side");
    await repo.add("a.txt", enc("side-1"));
    const sideTip = await repo.commit({ message: "side-1" });

    // Fabricate a Merge Commit joining main into side. Combining content is
    // ticket 07's job; only the graph shape (two Parents) matters here, so
    // the merge just reuses side's Tree.
    const sideCommit = (await repo.readCommit(sideTip.id))!;
    const mergeCommitId = await repo.writeCommit({
      tree: sideCommit.tree,
      parents: [mainTip.id, sideTip.id],
      author: sideCommit.author,
      committer: sideCommit.committer,
      message: "merge main into side",
    });
    await storage.setRef("refs/heads/side", mergeCommitId); // HEAD is "side"; advance it past the merge

    await repo.add("a.txt", enc("side-2"));
    const afterMerge = await repo.commit({ message: "side-2" });

    expect(await repo.mergeBase(afterMerge.id, mainTip.id)).toBe(mainTip.id);
    expect(await repo.mergeBase(afterMerge.id, sideTip.id)).toBe(sideTip.id);
  });

  it("is correct even when timestamps are out of order or identical", async () => {
    const repo = new Repository(new MemoryStorage());
    await repo.init();
    await repo.add("a.txt", enc("1"));
    const parent = await repo.commit({ message: "parent", author: { timestamp: 5000 } });
    await repo.add("a.txt", enc("2"));
    // A naive "most recent by timestamp" implementation would be fooled by an
    // earlier-dated child and by two Commits sharing one timestamp.
    const child = await repo.commit({ message: "child", author: { timestamp: 100 } });
    await repo.add("a.txt", enc("3"));
    const grandchild = await repo.commit({ message: "grandchild", author: { timestamp: 100 } });

    expect(await repo.mergeBase(parent.id, grandchild.id)).toBe(parent.id);
    expect(await repo.mergeBase(child.id, grandchild.id)).toBe(child.id);
  });

  it("returns undefined for Commits sharing no ancestor", async () => {
    const repo = new Repository(new MemoryStorage());
    await repo.init();
    await repo.add("a.txt", enc("1"));
    const c1 = await repo.commit({ message: "c1" });

    // A second, parentless root Commit: no shared history with c1 at all.
    const orphanTreeId = await repo.writeTree([]);
    const signature = { name: "mini-git", email: "mini-git@localhost", timestamp: 1, timezoneOffsetMinutes: 0 };
    const orphanId = await repo.writeCommit({
      tree: orphanTreeId,
      parents: [],
      author: signature,
      committer: signature,
      message: "independent root",
    });

    expect(await repo.mergeBase(c1.id, orphanId)).toBeUndefined();
  });
});

describe("Repository: merge", () => {
  it("is a no-op, and says so, when the target is already an ancestor of the current Branch", async () => {
    const repo = new Repository(new MemoryStorage());
    await repo.init();
    await repo.add("a.txt", enc("base"));
    const base = await repo.commit({ message: "base" });
    await repo.branch("old-feature");

    await repo.add("a.txt", enc("advanced"));
    const mainTip = await repo.commit({ message: "advance main" });

    const outcome = await repo.merge("old-feature");
    expect(outcome).toEqual({ type: "already-up-to-date", base: base.id });
    expect(await repo.headCommitId()).toBe(mainTip.id); // nothing moved
  });

  it("fast-forwards when the Merge Base is the current Branch's Commit, creating zero new Objects", async () => {
    const storage = new MemoryStorage();
    const repo = new Repository(storage);
    await repo.init();
    await repo.add("a.txt", enc("base"));
    const base = await repo.commit({ message: "base" });
    await repo.branch("feature");

    await storage.writeHead("refs/heads/feature");
    await repo.add("a.txt", enc("feature-1"));
    const featureTip = await repo.commit({ message: "on feature" });
    await storage.writeHead("refs/heads/main"); // main never advanced past base

    const before = storage.objectCount;
    const outcome = await repo.merge("feature");
    expect(storage.objectCount).toBe(before);

    expect(outcome).toEqual({ type: "fast-forward", base: base.id, from: base.id, to: featureTip.id });
    expect(await repo.headCommitId()).toBe(featureTip.id);
    expect(await repo.currentBranch()).toBe("refs/heads/main"); // still on main; main itself moved
  });

  it("reports diverged, without creating a Merge Commit, when both sides have moved", async () => {
    const storage = new MemoryStorage();
    const repo = new Repository(storage);
    await repo.init();
    await repo.add("a.txt", enc("base"));
    const base = await repo.commit({ message: "base" });
    await repo.branch("feature");

    await repo.add("a.txt", enc("main-1"));
    await repo.commit({ message: "on main" });

    await storage.writeHead("refs/heads/feature");
    await repo.add("a.txt", enc("feature-1"));
    await repo.commit({ message: "on feature" });
    await storage.writeHead("refs/heads/main");

    const outcome = await repo.merge("feature");
    expect(outcome).toEqual({ type: "diverged", base: base.id });
  });

  it("refuses to merge a Branch that does not exist", async () => {
    const repo = new Repository(new MemoryStorage());
    await repo.init();
    await repo.add("a.txt", enc("1"));
    await repo.commit({ message: "first" });
    await expect(repo.merge("nope")).rejects.toThrow(/does not exist/i);
  });
});
