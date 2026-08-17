import { describe, expect, it } from "vitest";
import { CheckoutConflictError, Repository } from "../src/engine/repository.js";
import { MemoryStorage } from "../src/engine/storage/memory.js";

const enc = (s: string) => new TextEncoder().encode(s);
const dec = (b: Uint8Array) => new TextDecoder().decode(b);

/** A minimal in-memory Working Tree standing in for real files, so tests can drive checkout without touching disk. */
function workingTree(initial: Record<string, string> = {}) {
  const files = new Map(Object.entries(initial).map(([path, content]) => [path, enc(content)]));
  return {
    files,
    set(path: string, content: string) {
      files.set(path, enc(content));
    },
    delete(path: string) {
      files.delete(path);
    },
    reader: async (path: string) => files.get(path),
  };
}

describe("Repository: branch", () => {
  it("creates a new Ref at the current Commit and creates zero new Objects", async () => {
    const storage = new MemoryStorage();
    const repo = new Repository(storage);
    await repo.init();
    await repo.add("a.txt", enc("v1"));
    const { id } = await repo.commit({ message: "first" });

    const before = storage.objectCount;
    await repo.branch("feature");
    expect(storage.objectCount).toBe(before);

    const branches = await repo.listBranches();
    const feature = branches.find((b) => b.name === "feature");
    expect(feature?.id).toBe(id);
  });

  it("refuses to create a branch before any Commit exists", async () => {
    const repo = new Repository(new MemoryStorage());
    await repo.init();
    await expect(repo.branch("feature")).rejects.toThrow(/no Commits/i);
  });

  it("refuses to create a branch that already exists", async () => {
    const repo = new Repository(new MemoryStorage());
    await repo.init();
    await repo.add("a.txt", enc("v1"));
    await repo.commit({ message: "first" });
    await repo.branch("feature");
    await expect(repo.branch("feature")).rejects.toThrow(/already exists/i);
  });

  it("lists branches, showing which one HEAD points at", async () => {
    const repo = new Repository(new MemoryStorage());
    await repo.init();
    await repo.add("a.txt", enc("v1"));
    await repo.commit({ message: "first" });
    await repo.branch("feature");

    let branches = await repo.listBranches();
    expect(branches.map((b) => [b.name, b.current])).toEqual([
      ["feature", false],
      ["main", true],
    ]);

    const wt = workingTree({ "a.txt": "v1" });
    await repo.checkout("feature", wt.reader);

    branches = await repo.listBranches();
    expect(branches.map((b) => [b.name, b.current])).toEqual([
      ["feature", true],
      ["main", false],
    ]);
  });
});

describe("Repository: checkout", () => {
  it("moves HEAD and reports the Working Tree writes needed to match the target Commit", async () => {
    const repo = new Repository(new MemoryStorage());
    await repo.init();
    await repo.add("a.txt", enc("v1"));
    await repo.commit({ message: "first" });
    await repo.branch("feature");
    await repo.add("a.txt", enc("v2"));
    await repo.commit({ message: "second, on main" });

    const wt = workingTree({ "a.txt": "v2" }); // clean: matches current HEAD (main)
    const result = await repo.checkout("feature", wt.reader);

    expect(await repo.currentBranch()).toBe("refs/heads/feature");
    expect(result.writes).toEqual([{ path: "a.txt", content: enc("v1") }]);
    expect(result.removes).toEqual([]);
  });

  it("removes files present in the old Commit but absent from the new one", async () => {
    const repo = new Repository(new MemoryStorage());
    await repo.init();
    await repo.add("a.txt", enc("v1"));
    await repo.commit({ message: "first" });
    await repo.branch("feature"); // feature has only a.txt

    await repo.add("b.txt", enc("new file"));
    await repo.commit({ message: "add b.txt, on main" });

    const wt = workingTree({ "a.txt": "v1", "b.txt": "new file" }); // clean
    const result = await repo.checkout("feature", wt.reader);

    expect(result.removes).toEqual(["b.txt"]);
    expect(result.writes).toEqual([]);
  });

  it("refuses when uncommitted changes would be overwritten, naming every offending path", async () => {
    const repo = new Repository(new MemoryStorage());
    await repo.init();
    await repo.add("a.txt", enc("v1"));
    await repo.add("b.txt", enc("v1"));
    await repo.commit({ message: "first" });
    await repo.branch("feature");

    // Advance feature past the shared base, then switch back is unnecessary —
    // checkout is called while HEAD is still on main. Advance feature's
    // target content directly to differ from the shared base in both files.
    const featureWt = workingTree({ "a.txt": "v1", "b.txt": "v1" });
    await repo.checkout("feature", featureWt.reader);
    featureWt.set("a.txt", "feature-a");
    featureWt.set("b.txt", "feature-b");
    await repo.add("a.txt", enc("feature-a"));
    await repo.add("b.txt", enc("feature-b"));
    await repo.commit({ message: "second, on feature" });
    await repo.checkout("main", featureWt.reader); // back to main, clean

    const mainWt = workingTree({ "a.txt": "dirty-a", "b.txt": "dirty-b" }); // uncommitted local edits
    await expect(repo.checkout("feature", mainWt.reader)).rejects.toMatchObject({
      name: "CheckoutConflictError",
      paths: ["a.txt", "b.txt"],
    });
    expect(await repo.currentBranch()).toBe("refs/heads/main"); // refused: HEAD did not move
  });

  it("throws CheckoutConflictError specifically, carrying the offending paths", async () => {
    const repo = new Repository(new MemoryStorage());
    await repo.init();
    await repo.add("a.txt", enc("v1"));
    await repo.commit({ message: "first" });
    await repo.branch("feature");
    await repo.add("a.txt", enc("v2"));
    await repo.commit({ message: "second, on main" });

    const wt = workingTree({ "a.txt": "dirty" });
    let caught: unknown;
    try {
      await repo.checkout("feature", wt.reader);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(CheckoutConflictError);
    expect((caught as CheckoutConflictError).paths).toEqual(["a.txt"]);
  });

  it("carries uncommitted changes across untouched when the file does not differ between the two Commits", async () => {
    const repo = new Repository(new MemoryStorage());
    await repo.init();
    await repo.add("a.txt", enc("v1"));
    await repo.add("shared.txt", enc("same everywhere"));
    await repo.commit({ message: "first" });
    await repo.branch("feature");
    await repo.add("a.txt", enc("v2")); // only a.txt changes on main
    await repo.commit({ message: "second, on main" });

    const wt = workingTree({ "a.txt": "v2", "shared.txt": "locally-edited" }); // shared.txt dirty
    const result = await repo.checkout("feature", wt.reader);

    expect(result.writes).toEqual([{ path: "a.txt", content: enc("v1") }]);
    expect(result.removes).toEqual([]); // shared.txt never appears: left untouched
  });

  it("refuses when checking out a branch that does not exist", async () => {
    const repo = new Repository(new MemoryStorage());
    await repo.init();
    await repo.add("a.txt", enc("v1"));
    await repo.commit({ message: "first" });
    const wt = workingTree({ "a.txt": "v1" });
    await expect(repo.checkout("nope", wt.reader)).rejects.toThrow(/does not exist/i);
  });
});

describe("Repository: divergent history", () => {
  it("committing on two Branches leaves both reachable, diverging from a shared Commit", async () => {
    const repo = new Repository(new MemoryStorage());
    await repo.init();
    await repo.add("a.txt", enc("v1"));
    const base = await repo.commit({ message: "base" });
    await repo.branch("feature");

    await repo.add("a.txt", enc("main-v2"));
    const mainTip = await repo.commit({ message: "on main" });

    const wt = workingTree({ "a.txt": "main-v2" }); // clean: matches current HEAD (main tip)
    await repo.checkout("feature", wt.reader);
    await repo.add("a.txt", enc("feature-v2"));
    const featureTip = await repo.commit({ message: "on feature" });

    expect(mainTip.id).not.toBe(featureTip.id);
    const mainCommit = await repo.readCommit(mainTip.id);
    const featureCommit = await repo.readCommit(featureTip.id);
    expect(mainCommit?.parents).toEqual([base.id]);
    expect(featureCommit?.parents).toEqual([base.id]);

    const branches = await repo.listBranches();
    expect(branches.find((b) => b.name === "main")?.id).toBe(mainTip.id);
    expect(branches.find((b) => b.name === "feature")?.id).toBe(featureTip.id);

    const mainBlob = await repo.readBlob((await repo.readTree(mainCommit!.tree))!.find((e) => e.name === "a.txt")!.id);
    expect(dec(mainBlob!)).toBe("main-v2");
  });
});

describe("Repository: deleteBranch", () => {
  it("removes the Ref and destroys no Objects", async () => {
    const storage = new MemoryStorage();
    const repo = new Repository(storage);
    await repo.init();
    await repo.add("a.txt", enc("v1"));
    await repo.commit({ message: "first" });
    await repo.branch("feature");

    const before = storage.objectCount;
    await repo.deleteBranch("feature");
    expect(storage.objectCount).toBe(before);
    expect((await repo.listBranches()).map((b) => b.name)).toEqual(["main"]);
  });

  it("refuses to delete a branch that does not exist", async () => {
    const repo = new Repository(new MemoryStorage());
    await repo.init();
    await expect(repo.deleteBranch("nope")).rejects.toThrow(/does not exist/i);
  });

  it("refuses to delete the current branch", async () => {
    const repo = new Repository(new MemoryStorage());
    await repo.init();
    await repo.add("a.txt", enc("v1"));
    await repo.commit({ message: "first" });
    await expect(repo.deleteBranch("main")).rejects.toThrow(/current branch/i);
  });
});
