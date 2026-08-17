import { describe, expect, it } from "vitest";
import { Repository } from "../src/engine/repository.js";
import { MemoryStorage } from "../src/engine/storage/memory.js";

const enc = (s: string) => new TextEncoder().encode(s);

describe("Repository: graphLayout", () => {
  it("lays out a linear history in topological order with a single lane", async () => {
    const repo = new Repository(new MemoryStorage());
    await repo.init();
    await repo.add("a.txt", enc("1"));
    const c1 = await repo.commit({ message: "c1" });
    await repo.add("a.txt", enc("2"));
    const c2 = await repo.commit({ message: "c2" });

    const layout = await repo.graphLayout();
    expect(layout.nodes).toHaveLength(2);
    const n1 = layout.nodes.find((n) => n.id === c1.id)!;
    const n2 = layout.nodes.find((n) => n.id === c2.id)!;
    expect(n1.row).toBeLessThan(n2.row);
    expect(layout.edges).toEqual([{ from: c2.id, to: c1.id }]);
  });

  it("gives a real Merge Commit two edges and marks the shape of a diverge-then-merge history", async () => {
    const storage = new MemoryStorage();
    const repo = new Repository(storage);
    await repo.init();
    await repo.add("a.txt", enc("base"));
    const base = await repo.commit({ message: "base" });
    await repo.branch("feature");

    await repo.add("a.txt", enc("main-1"));
    const mainTip = await repo.commit({ message: "on main" });

    await storage.writeHead("refs/heads/feature");
    await repo.add("b.txt", enc("feature-1"));
    const featureTip = await repo.commit({ message: "on feature" });
    await storage.writeHead("refs/heads/main");

    const outcome = await repo.merge("feature");
    expect(outcome.type).toBe("merged");
    if (outcome.type !== "merged") throw new Error("unreachable");

    const layout = await repo.graphLayout();
    expect(layout.nodes).toHaveLength(4);

    const mergeEdges = layout.edges.filter((e) => e.from === outcome.id);
    expect(mergeEdges).toHaveLength(2);
    expect(mergeEdges.map((e) => e.to).sort()).toEqual([featureTip.id, mainTip.id].sort());

    const baseNode = layout.nodes.find((n) => n.id === base.id)!;
    const mergeNode = layout.nodes.find((n) => n.id === outcome.id)!;
    expect(baseNode.row).toBeLessThan(mergeNode.row);
  });

  it("gives diverged Branches distinct lanes before they merge", async () => {
    const storage = new MemoryStorage();
    const repo = new Repository(storage);
    await repo.init();
    await repo.add("a.txt", enc("base"));
    await repo.commit({ message: "base" });
    await repo.branch("feature");

    await repo.add("a.txt", enc("main-1"));
    const mainTip = await repo.commit({ message: "on main" });

    await storage.writeHead("refs/heads/feature");
    await repo.add("b.txt", enc("feature-1"));
    const featureTip = await repo.commit({ message: "on feature" });
    await storage.writeHead("refs/heads/main");

    const layout = await repo.graphLayout();
    const mainNode = layout.nodes.find((n) => n.id === mainTip.id)!;
    const featureNode = layout.nodes.find((n) => n.id === featureTip.id)!;
    expect(mainNode.lane).not.toBe(featureNode.lane);
  });

  it("is correct for a criss-cross history built from two real merges, each merging the other", async () => {
    const storage = new MemoryStorage();
    const repo = new Repository(storage);
    await repo.init();
    await repo.add("shared.txt", enc("base"));
    await repo.commit({ message: "base" });
    await repo.branch("b");

    await repo.add("a-only.txt", enc("x"));
    const a1 = await repo.commit({ message: "a1" });
    await repo.branch("a"); // a stable pointer to a1, independent of main's later movement

    await storage.writeHead("refs/heads/b");
    await repo.add("b-only.txt", enc("y"));
    const b1 = await repo.commit({ message: "b1" });

    await storage.writeHead("refs/heads/main");
    const mainMerge = await repo.merge("b"); // main merges b1
    expect(mainMerge.type).toBe("merged");
    if (mainMerge.type !== "merged") throw new Error("unreachable");

    await storage.writeHead("refs/heads/b");
    const bMerge = await repo.merge("a"); // b merges the original a1 tip: neither side is an ancestor of the other
    expect(bMerge.type).toBe("merged");
    if (bMerge.type !== "merged") throw new Error("unreachable");

    const layout = await repo.graphLayout();
    expect(layout.nodes.map((n) => n.id)).toEqual(
      expect.arrayContaining([a1.id, b1.id, mainMerge.id, bMerge.id]),
    );
    for (const node of layout.nodes) {
      for (const parentId of node.parents) {
        const parentRow = layout.nodes.find((n) => n.id === parentId)!.row;
        expect(parentRow).toBeLessThan(node.row);
      }
    }
  });

  it("returns an empty layout for a Repository with no Commits", async () => {
    const repo = new Repository(new MemoryStorage());
    await repo.init();
    const layout = await repo.graphLayout();
    expect(layout).toEqual({ nodes: [], edges: [] });
  });
});
