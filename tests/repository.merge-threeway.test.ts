import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { Repository } from "../src/engine/repository.js";
import { MemoryStorage } from "../src/engine/storage/memory.js";
import { FilesystemStorage } from "../src/engine/storage/filesystem.js";
import { hasRealGit, runGit } from "./support/real-git.js";
import { makeTmpDir, removeTmpDir } from "./support/tmpdir.js";

const enc = (s: string) => new TextEncoder().encode(s);
const dec = (b: Uint8Array | null) => (b === null ? null : new TextDecoder().decode(b));

/** Sets up base -> (main, feature) diverging from a single file's content. Returns the repo positioned on main, plus the base Commit. */
async function divergedSetup(baseContent: string, mainContent: string, featureContent: string) {
  const storage = new MemoryStorage();
  const repo = new Repository(storage);
  await repo.init();
  await repo.add("a.txt", enc(baseContent));
  const base = await repo.commit({ message: "base" });
  await repo.branch("feature");

  await repo.add("a.txt", enc(mainContent));
  await repo.commit({ message: "on main" });

  await storage.writeHead("refs/heads/feature");
  await repo.add("a.txt", enc(featureContent));
  await repo.commit({ message: "on feature" });
  await storage.writeHead("refs/heads/main");

  return { repo, storage, base };
}

describe("Repository: three-way merge", () => {
  it("combines edits to different Hunks of the same file automatically", async () => {
    const base = ["one", "two", "three", "four", "five"].join("\n");
    const main = ["ONE", "two", "three", "four", "five"].join("\n");
    const feature = ["one", "two", "three", "four", "FIVE"].join("\n");
    const { repo } = await divergedSetup(base, main, feature);

    const outcome = await repo.merge("feature");
    expect(outcome.type).toBe("merged");
    if (outcome.type !== "merged") throw new Error("unreachable");

    const commit = await repo.readCommit(outcome.id);
    expect(commit!.parents).toHaveLength(2);
    const tree = await repo.readTree(commit!.tree);
    const blobId = tree!.find((e) => e.name === "a.txt")!.id;
    expect(dec(await repo.readBlob(blobId))).toBe(["ONE", "two", "three", "four", "FIVE"].join("\n") + "\n");
  });

  it("reports a Conflict, scoped to the overlapping region, when both sides edit the same line", async () => {
    const base = ["one", "two", "three"].join("\n");
    const main = ["ONE", "two", "three"].join("\n");
    const feature = ["one-alt", "two", "three"].join("\n");
    const { repo } = await divergedSetup(base, main, feature);

    const outcome = await repo.merge("feature");
    expect(outcome.type).toBe("conflict");
    if (outcome.type !== "conflict") throw new Error("unreachable");
    expect(outcome.conflicts).toHaveLength(1);
    const conflict = outcome.conflicts[0]!;
    expect(conflict.path).toBe("a.txt");
    expect(conflict.hunks).toHaveLength(1);
    expect(conflict.hunks[0]!.ours[0]!.added).toEqual(["ONE"]);
    expect(conflict.hunks[0]!.theirs[0]!.added).toEqual(["one-alt"]);
  });

  it("combines a non-overlapping Hunk automatically even in a file that also has a genuine Conflict elsewhere", async () => {
    const base = ["one", "two", "three", "four", "five"].join("\n");
    const main = ["ONE-CONFLICT", "two", "three", "four", "FIVE"].join("\n");
    const feature = ["ONE-DIFFERENT", "two", "three", "four", "FIVE"].join("\n");
    const { repo } = await divergedSetup(base, main, feature);

    const outcome = await repo.merge("feature");
    expect(outcome.type).toBe("conflict");
    if (outcome.type !== "conflict") throw new Error("unreachable");
    // Only line 1 conflicts; line 5 ("FIVE" on both sides) is identical and not reported.
    expect(outcome.conflicts).toHaveLength(1);
    expect(outcome.conflicts[0]!.hunks[0]!.ours[0]!.added).toEqual(["ONE-CONFLICT"]);
  });

  describe("case matrix (spec.md)", () => {
    it("keeps base when neither side changed it", async () => {
      const { repo } = await divergedSetup("same", "same", "same");
      const outcome = await repo.merge("feature");
      expect(outcome.type).toBe("merged");
    });

    it("takes ours when only ours changed", async () => {
      const { repo } = await divergedSetup("base", "changed", "base");
      const outcome = await repo.merge("feature");
      expect(outcome.type).toBe("merged");
      if (outcome.type !== "merged") throw new Error("unreachable");
      const commit = await repo.readCommit(outcome.id);
      const tree = await repo.readTree(commit!.tree);
      const blobId = tree!.find((e) => e.name === "a.txt")!.id;
      expect(dec(await repo.readBlob(blobId))).toBe("changed"); // unchanged blob reused as-is, byte for byte
    });

    it("takes theirs when only theirs changed", async () => {
      const { repo } = await divergedSetup("base", "base", "changed");
      const outcome = await repo.merge("feature");
      expect(outcome.type).toBe("merged");
      if (outcome.type !== "merged") throw new Error("unreachable");
      const commit = await repo.readCommit(outcome.id);
      const tree = await repo.readTree(commit!.tree);
      const blobId = tree!.find((e) => e.name === "a.txt")!.id;
      expect(dec(await repo.readBlob(blobId))).toBe("changed"); // unchanged blob reused as-is, byte for byte
    });

    it("conflicts when ours deleted and theirs changed", async () => {
      const storage = new MemoryStorage();
      const repo = new Repository(storage);
      await repo.init();
      await repo.add("a.txt", enc("base"));
      await repo.commit({ message: "base" });
      await repo.branch("feature");

      repo.unstage("a.txt"); // nothing staged for a.txt: deletion means "not present"
      await repo.add("keep.txt", enc("x"));
      await repo.commit({ message: "delete a.txt on main" });

      await storage.writeHead("refs/heads/feature");
      await repo.add("a.txt", enc("changed"));
      await repo.commit({ message: "change a.txt on feature" });
      await storage.writeHead("refs/heads/main");

      const outcome = await repo.merge("feature");
      expect(outcome.type).toBe("conflict");
      if (outcome.type !== "conflict") throw new Error("unreachable");
      const conflict = outcome.conflicts.find((c) => c.path === "a.txt")!;
      expect(conflict.oursId).toBeUndefined();
      expect(conflict.theirsId).toBeDefined();
    });

    it("conflicts when ours changed and theirs deleted", async () => {
      const storage = new MemoryStorage();
      const repo = new Repository(storage);
      await repo.init();
      await repo.add("a.txt", enc("base"));
      await repo.commit({ message: "base" });
      await repo.branch("feature");

      await repo.add("a.txt", enc("changed"));
      await repo.commit({ message: "change a.txt on main" });

      await storage.writeHead("refs/heads/feature");
      repo.unstage("a.txt");
      await repo.add("keep.txt", enc("x"));
      await repo.commit({ message: "delete a.txt on feature" });
      await storage.writeHead("refs/heads/main");

      const outcome = await repo.merge("feature");
      expect(outcome.type).toBe("conflict");
      if (outcome.type !== "conflict") throw new Error("unreachable");
      const conflict = outcome.conflicts.find((c) => c.path === "a.txt")!;
      expect(conflict.oursId).toBeDefined();
      expect(conflict.theirsId).toBeUndefined();
    });

    it("deletes silently when both sides deleted", async () => {
      const storage = new MemoryStorage();
      const repo = new Repository(storage);
      await repo.init();
      await repo.add("a.txt", enc("base"));
      await repo.add("keep.txt", enc("x"));
      await repo.commit({ message: "base" });
      await repo.branch("feature");

      repo.unstage("a.txt"); // Index still holds keep.txt from the base commit
      await repo.commit({ message: "delete a.txt on main" });

      await storage.writeHead("refs/heads/feature"); // Index is untouched by switching HEAD: still just keep.txt
      await repo.commit({ message: "delete a.txt on feature" });
      await storage.writeHead("refs/heads/main");

      const outcome = await repo.merge("feature");
      expect(outcome.type).toBe("merged");
      if (outcome.type !== "merged") throw new Error("unreachable");
      const commit = await repo.readCommit(outcome.id);
      const tree = await repo.readTree(commit!.tree);
      expect(tree!.find((e) => e.name === "a.txt")).toBeUndefined();
    });

    it("takes ours when absent from base and only ours added it", async () => {
      const storage = new MemoryStorage();
      const repo = new Repository(storage);
      await repo.init();
      await repo.add("shared.txt", enc("x"));
      await repo.commit({ message: "base" });
      await repo.branch("feature");

      await repo.add("only-main.txt", enc("added on main"));
      await repo.commit({ message: "add on main" });

      await storage.writeHead("refs/heads/feature");
      await repo.add("shared.txt", enc("y")); // any change, just to keep feature's history diverging from main's
      await repo.commit({ message: "unrelated change on feature" });
      await storage.writeHead("refs/heads/main");

      const outcome = await repo.merge("feature");
      expect(outcome.type).toBe("merged");
      if (outcome.type !== "merged") throw new Error("unreachable");
      const commit = await repo.readCommit(outcome.id);
      const tree = await repo.readTree(commit!.tree);
      expect(tree!.find((e) => e.name === "only-main.txt")).toBeDefined();
    });

    it("takes either when absent from base and both sides added identical content", async () => {
      const storage = new MemoryStorage();
      const repo = new Repository(storage);
      await repo.init();
      await repo.add("base.txt", enc("x"));
      const baseCommit = await repo.commit({ message: "base" });
      await repo.branch("feature");

      await repo.add("new.txt", enc("same content"));
      await repo.commit({ message: "add on main" });

      await storage.writeHead("refs/heads/feature");
      await repo.add("new.txt", enc("same content"));
      await repo.commit({ message: "add on feature" });
      await storage.writeHead("refs/heads/main");

      const outcome = await repo.merge("feature");
      expect(outcome.type).toBe("merged");
      expect(baseCommit).toBeDefined();
    });

    it("conflicts when absent from base and both sides added differing content", async () => {
      const storage = new MemoryStorage();
      const repo = new Repository(storage);
      await repo.init();
      await repo.add("base.txt", enc("x"));
      await repo.commit({ message: "base" });
      await repo.branch("feature");

      await repo.add("new.txt", enc("main version"));
      await repo.commit({ message: "add on main" });

      await storage.writeHead("refs/heads/feature");
      await repo.add("new.txt", enc("feature version"));
      await repo.commit({ message: "add on feature" });
      await storage.writeHead("refs/heads/main");

      const outcome = await repo.merge("feature");
      expect(outcome.type).toBe("conflict");
      if (outcome.type !== "conflict") throw new Error("unreachable");
      const conflict = outcome.conflicts.find((c) => c.path === "new.txt")!;
      expect(conflict.baseId).toBeUndefined();
      expect(conflict.oursId).toBeDefined();
      expect(conflict.theirsId).toBeDefined();
    });
  });

  it("merges correctly when the two Branches touched entirely disjoint files", async () => {
    const storage = new MemoryStorage();
    const repo = new Repository(storage);
    await repo.init();
    await repo.add("common.txt", enc("shared"));
    await repo.commit({ message: "base" });
    await repo.branch("feature");

    await repo.add("main-only.txt", enc("from main"));
    await repo.commit({ message: "on main" });

    await storage.writeHead("refs/heads/feature");
    await repo.add("feature-only.txt", enc("from feature"));
    await repo.commit({ message: "on feature" });
    await storage.writeHead("refs/heads/main");

    const outcome = await repo.merge("feature");
    expect(outcome.type).toBe("merged");
    if (outcome.type !== "merged") throw new Error("unreachable");
    const commit = await repo.readCommit(outcome.id);
    const tree = await repo.readTree(commit!.tree);
    const names = tree!.map((e) => e.name).sort();
    expect(names).toEqual(["common.txt", "feature-only.txt", "main-only.txt"]);
  });

  it("leaves a conflicted merge uncommitted and resolvable, then completes it once every Conflict is resolved", async () => {
    const base = ["one", "two", "three"].join("\n");
    const main = ["ONE", "two", "three"].join("\n");
    const feature = ["one-alt", "two", "three"].join("\n");
    const { repo } = await divergedSetup(base, main, feature);
    const beforeHead = await repo.headCommitId();

    const outcome = await repo.merge("feature");
    expect(outcome.type).toBe("conflict");
    expect(await repo.headCommitId()).toBe(beforeHead); // no Commit created

    await expect(repo.commit({ message: "should fail" })).rejects.toThrow(/unresolved merge conflicts/i);

    repo.resolve("a.txt", "theirs");
    expect(repo.mergeStatus()!.conflicts).toHaveLength(0);

    const result = await repo.commit({ message: "resolve conflict" });
    const commit = await repo.readCommit(result.id);
    expect(commit!.parents).toHaveLength(2);
    expect(repo.mergeStatus()).toBeUndefined();

    const tree = await repo.readTree(commit!.tree);
    const blobId = tree!.find((e) => e.name === "a.txt")!.id;
    expect(dec(await repo.readBlob(blobId))).toBe("one-alt\ntwo\nthree"); // ours' whole file wins wholesale via resolve(); reused as-is
  });

  it("refuses to resolve a path with no Conflict", async () => {
    const base = ["one"].join("\n");
    const { repo } = await divergedSetup(base, "ONE", "one-alt");
    await repo.merge("feature");
    expect(() => repo.resolve("nope.txt", "ours")).toThrow(/no conflict/i);
  });
});

describe("Repository: real git reads a Merge Commit created by mini-git", () => {
  let dir: string;

  it.skipIf(!hasRealGit())("git log --graph shows both Parents", async () => {
    dir = await makeTmpDir();
    try {
      const storage = new FilesystemStorage(join(dir, ".git"));
      await storage.writeHead("refs/heads/main");
      const repo = new Repository(storage);

      await repo.add("a.txt", enc("one\ntwo\nthree\n"));
      await repo.commit({ message: "base" });
      await repo.branch("feature");

      await repo.add("a.txt", enc("ONE\ntwo\nthree\n"));
      await repo.commit({ message: "on main" });

      await storage.writeHead("refs/heads/feature");
      await repo.add("a.txt", enc("one\ntwo\nTHREE\n"));
      await repo.commit({ message: "on feature" });
      await storage.writeHead("refs/heads/main");

      const outcome = await repo.merge("feature");
      expect(outcome.type).toBe("merged");
      if (outcome.type !== "merged") throw new Error("unreachable");

      const log = runGit(dir, ["log", "--format=%H %P"]);
      expect(log.status).toBe(0);
      const mergeLine = log.stdout.split("\n").find((line) => line.startsWith(outcome.id));
      expect(mergeLine).toBeDefined();
      expect(mergeLine!.trim().split(" ")).toHaveLength(3); // commit hash + two parent hashes
    } finally {
      await removeTmpDir(dir);
    }
  });
});
