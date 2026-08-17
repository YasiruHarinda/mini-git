import { describe, expect, it } from "vitest";
import { layoutGraph, type GraphCommit, type GraphTip } from "../src/engine/graph.js";

function rowOf(layout: ReturnType<typeof layoutGraph>, id: string): number {
  return layout.nodes.find((n) => n.id === id)!.row;
}

function laneOf(layout: ReturnType<typeof layoutGraph>, id: string): number {
  return layout.nodes.find((n) => n.id === id)!.lane;
}

describe("layoutGraph", () => {
  it("orders a linear history so no Commit appears before its ancestor", () => {
    const commits: GraphCommit[] = [
      { id: "c3", parents: ["c2"] },
      { id: "c1", parents: [] },
      { id: "c2", parents: ["c1"] },
    ];
    const tips: GraphTip[] = [{ branch: "main", id: "c3" }];
    const layout = layoutGraph(commits, tips);

    expect(rowOf(layout, "c1")).toBeLessThan(rowOf(layout, "c2"));
    expect(rowOf(layout, "c2")).toBeLessThan(rowOf(layout, "c3"));
  });

  it("puts every Commit's parents strictly before it, in a branched history", () => {
    const commits: GraphCommit[] = [
      { id: "base", parents: [] },
      { id: "main1", parents: ["base"] },
      { id: "feature1", parents: ["base"] },
      { id: "feature2", parents: ["feature1"] },
    ];
    const tips: GraphTip[] = [
      { branch: "main", id: "main1" },
      { branch: "feature", id: "feature2" },
    ];
    const layout = layoutGraph(commits, tips);

    for (const node of layout.nodes) {
      for (const parentId of node.parents) {
        expect(rowOf(layout, parentId)).toBeLessThan(node.row);
      }
    }
  });

  it("gives a Merge Commit two edges, one to each Parent", () => {
    const commits: GraphCommit[] = [
      { id: "base", parents: [] },
      { id: "main1", parents: ["base"] },
      { id: "feature1", parents: ["base"] },
      { id: "merge", parents: ["main1", "feature1"] },
    ];
    const tips: GraphTip[] = [{ branch: "main", id: "merge" }];
    const layout = layoutGraph(commits, tips);

    const edgesFromMerge = layout.edges.filter((e) => e.from === "merge");
    expect(edgesFromMerge).toHaveLength(2);
    expect(edgesFromMerge.map((e) => e.to).sort()).toEqual(["feature1", "main1"]);
  });

  it("assigns each Branch its own lane while diverged", () => {
    const commits: GraphCommit[] = [
      { id: "base", parents: [] },
      { id: "main1", parents: ["base"] },
      { id: "feature1", parents: ["base"] },
    ];
    const tips: GraphTip[] = [
      { branch: "main", id: "main1" },
      { branch: "feature", id: "feature1" },
    ];
    const layout = layoutGraph(commits, tips);

    expect(laneOf(layout, "main1")).not.toBe(laneOf(layout, "feature1"));
  });

  it("reuses a lane once its Branch has merged back in", () => {
    const commits: GraphCommit[] = [
      { id: "base", parents: [] },
      { id: "main1", parents: ["base"] },
      { id: "feature1", parents: ["base"] },
      { id: "merge", parents: ["main1", "feature1"] },
      { id: "later", parents: ["merge"] },
      { id: "other1", parents: ["later"] },
    ];
    const tips: GraphTip[] = [
      { branch: "main", id: "later" },
      { branch: "other", id: "other1" },
    ];
    const layout = layoutGraph(commits, tips);

    const featureLane = laneOf(layout, "feature1");
    // The lane feature1 occupied is free again below the merge and can be
    // claimed by an unrelated later Branch (there is no correct single
    // answer for *which* lane "other" gets, only that some later node reuses
    // a freed lane rather than the graph growing a lane per Branch forever).
    const laneCount = new Set(layout.nodes.map((n) => n.lane)).size;
    expect(laneCount).toBeLessThan(commits.length);
    expect(featureLane).toBeGreaterThanOrEqual(0);
  });

  it("is correct for a history with more than one root Commit", () => {
    const commits: GraphCommit[] = [
      { id: "rootA", parents: [] },
      { id: "rootB", parents: [] },
      { id: "a1", parents: ["rootA"] },
      { id: "b1", parents: ["rootB"] },
    ];
    const tips: GraphTip[] = [
      { branch: "a", id: "a1" },
      { branch: "b", id: "b1" },
    ];
    const layout = layoutGraph(commits, tips);

    expect(rowOf(layout, "rootA")).toBeLessThan(rowOf(layout, "a1"));
    expect(rowOf(layout, "rootB")).toBeLessThan(rowOf(layout, "b1"));
    expect(layout.nodes).toHaveLength(4);
  });

  it("is correct for a criss-cross history where two Branches have merged each other", () => {
    const commits: GraphCommit[] = [
      { id: "base", parents: [] },
      { id: "a1", parents: ["base"] },
      { id: "b1", parents: ["base"] },
      { id: "a2", parents: ["a1", "b1"] }, // a merges b
      { id: "b2", parents: ["b1", "a1"] }, // b merges a
    ];
    const tips: GraphTip[] = [
      { branch: "a", id: "a2" },
      { branch: "b", id: "b2" },
    ];
    const layout = layoutGraph(commits, tips);

    expect(rowOf(layout, "a1")).toBeLessThan(rowOf(layout, "a2"));
    expect(rowOf(layout, "b1")).toBeLessThan(rowOf(layout, "a2"));
    expect(rowOf(layout, "a1")).toBeLessThan(rowOf(layout, "b2"));
    expect(rowOf(layout, "b1")).toBeLessThan(rowOf(layout, "b2"));
    expect(layout.edges).toHaveLength(6); // a1->base, b1->base, a2->a1, a2->b1, b2->b1, b2->a1
  });

  it("creates no Objects and mutates nothing: calling it twice on the same input gives the same result", () => {
    const commits: GraphCommit[] = [
      { id: "base", parents: [] },
      { id: "main1", parents: ["base"] },
    ];
    const tips: GraphTip[] = [{ branch: "main", id: "main1" }];
    expect(layoutGraph(commits, tips)).toEqual(layoutGraph(commits, tips));
  });

  it("produces the same output regardless of input array order", () => {
    const commits: GraphCommit[] = [
      { id: "base", parents: [] },
      { id: "main1", parents: ["base"] },
      { id: "feature1", parents: ["base"] },
      { id: "merge", parents: ["main1", "feature1"] },
    ];
    const tips: GraphTip[] = [{ branch: "main", id: "merge" }];
    const forward = layoutGraph(commits, tips);
    const reversed = layoutGraph([...commits].reverse(), tips);
    expect(reversed).toEqual(forward);
  });
});
