/**
 * Pure Commit graph layout (CONTEXT.md: History, Branch, Merge Commit). No
 * storage, no Objects — maps a set of Commits and Branch tips to positioned
 * nodes and edges, the way `diff.ts` and `merge.ts` are pure over content.
 * Nothing is drawn here; the output is data for an interface to render.
 */

export interface GraphCommit {
  id: string;
  parents: string[];
}

export interface GraphTip {
  branch: string;
  id: string;
}

export interface GraphNode {
  id: string;
  parents: string[];
  /** 0 at the root end of History; strictly greater than every ancestor's row. */
  row: number;
  /** Horizontal lane. Reused once the Branch that opened it has merged or ended. */
  lane: number;
}

export interface GraphEdge {
  /** Child Commit's Object ID. */
  from: string;
  /** Parent Commit's Object ID. */
  to: string;
}

export interface GraphLayout {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/**
 * Orders Commits so no Commit precedes an ancestor (Kahn's algorithm over
 * the parent DAG), breaking every tie by Object ID so the result never
 * depends on Map or Set iteration order.
 */
function topologicalOrder(byId: Map<string, GraphCommit>): string[] {
  const childCount = new Map<string, number>();
  for (const id of byId.keys()) childCount.set(id, 0);
  const children = new Map<string, string[]>();
  for (const commit of byId.values()) {
    for (const parentId of commit.parents) {
      if (!byId.has(parentId)) continue;
      childCount.set(parentId, (childCount.get(parentId) ?? 0) + 1);
      if (!children.has(parentId)) children.set(parentId, []);
      children.get(parentId)!.push(commit.id);
    }
  }

  // "Ready" means every parent within the set already has a row assigned —
  // i.e. remaining in-degree, counted the other direction, is zero. We track
  // it as remaining parent count so a Commit becomes ready once its last
  // unplaced parent is placed.
  const remainingParents = new Map<string, number>();
  for (const commit of byId.values()) {
    remainingParents.set(
      commit.id,
      commit.parents.filter((p) => byId.has(p)).length,
    );
  }

  let ready = [...byId.keys()].filter((id) => remainingParents.get(id) === 0);
  const order: string[] = [];
  while (ready.length > 0) {
    ready.sort();
    const id = ready.shift()!;
    order.push(id);
    for (const childId of children.get(id) ?? []) {
      const remaining = remainingParents.get(childId)! - 1;
      remainingParents.set(childId, remaining);
      if (remaining === 0) ready.push(childId);
    }
  }
  return order;
}

/**
 * Maps Commits reachable from `tips` to nodes with a row (topological
 * position) and a lane (which Branch's line they sit on), plus edges to
 * every Parent. Creates no Objects and mutates nothing — a pure function of
 * its input.
 */
export function layoutGraph(commits: GraphCommit[], tips: GraphTip[]): GraphLayout {
  const byId = new Map(commits.map((c) => [c.id, c]));
  const order = topologicalOrder(byId); // root-first
  const rowOf = new Map(order.map((id, i) => [id, i]));

  const edges: GraphEdge[] = [];
  for (const commit of commits) {
    for (const parentId of commit.parents) {
      if (byId.has(parentId)) edges.push({ from: commit.id, to: parentId });
    }
  }
  edges.sort((a, b) => (a.from === b.from ? (a.to < b.to ? -1 : 1) : a.from < b.from ? -1 : 1));

  const tipsById = new Map<string, string[]>(); // commit id -> Branch names sorted, for deterministic lane opening
  for (const tip of tips) {
    if (!tipsById.has(tip.id)) tipsById.set(tip.id, []);
    tipsById.get(tip.id)!.push(tip.branch);
  }
  for (const names of tipsById.values()) names.sort();
  const sortedTipIds = [...tipsById.keys()].sort((a, b) => {
    const nameA = tipsById.get(a)![0]!;
    const nameB = tipsById.get(b)![0]!;
    return nameA < nameB ? -1 : nameA > nameB ? 1 : 0;
  });

  // lanes[i] holds the Commit that lane currently expects to reach next
  // (walking Parents downward), or null once freed for reuse.
  const lanes: (string | null)[] = [];
  const laneOfCommit = new Map<string, number>();

  function allocateLane(expecting: string): number {
    const free = lanes.indexOf(null);
    const index = free === -1 ? lanes.length : free;
    lanes[index] = expecting;
    return index;
  }

  for (const tipId of sortedTipIds) {
    if (!lanes.includes(tipId)) allocateLane(tipId);
  }

  for (let row = order.length - 1; row >= 0; row--) {
    const id = order[row]!;
    const commit = byId.get(id)!;

    const candidates: number[] = [];
    for (let i = 0; i < lanes.length; i++) {
      if (lanes[i] === id) candidates.push(i);
    }
    if (candidates.length === 0) {
      candidates.push(allocateLane(id));
    }

    const winner = Math.min(...candidates);
    for (const i of candidates) {
      if (i !== winner) lanes[i] = null; // converging lanes collapse into the winner
    }
    laneOfCommit.set(id, winner);

    const [firstParent, ...restParents] = commit.parents.filter((p) => byId.has(p));
    lanes[winner] = firstParent ?? null; // no parent left in the set: this lane's line ends here

    for (const parentId of restParents) {
      if (!lanes.includes(parentId)) allocateLane(parentId);
    }
  }

  const nodes: GraphNode[] = order.map((id) => ({
    id,
    parents: byId.get(id)!.parents,
    row: rowOf.get(id)!,
    lane: laneOfCommit.get(id)!,
  }));

  return { nodes, edges };
}
