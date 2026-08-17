/**
 * Pure three-way line merge (CONTEXT.md: Three-way Merge, Hunk, Conflict).
 * No storage, no Objects — combines text by comparing both sides against
 * the Merge Base, the same way `diff.ts` compares two Commits.
 */
import { diffLines, type Hunk } from "./diff.js";

function splitLines(text: string): string[] {
  if (text.length === 0) return [];
  const lines = text.split("\n");
  if (lines[lines.length - 1] === "") lines.pop();
  return lines;
}

function joinLines(lines: string[]): string {
  return lines.length === 0 ? "" : lines.join("\n") + "\n";
}

interface TaggedHunk {
  hunk: Hunk;
  side: "ours" | "theirs";
}

function hunkRange(hunk: Hunk): { start: number; end: number } {
  const start = hunk.oldStart - 1;
  return { start, end: start + hunk.removed.length };
}

/**
 * Whether two Hunks — one from each side — contend for the same region of
 * the Merge Base. A pure insertion (nothing removed) has no width of its
 * own, so it overlaps whatever sits at its anchor point rather than never
 * overlapping at all.
 */
function hunksOverlap(a: Hunk, b: Hunk): boolean {
  const ra = hunkRange(a);
  const rb = hunkRange(b);
  const aIsInsertion = a.removed.length === 0;
  const bIsInsertion = b.removed.length === 0;
  if (aIsInsertion && bIsInsertion) return ra.start === rb.start;
  if (aIsInsertion) return ra.start >= rb.start && ra.start <= rb.end;
  if (bIsInsertion) return rb.start >= ra.start && rb.start <= ra.end;
  return ra.start < rb.end && rb.start < ra.end;
}

/** Applies non-overlapping Hunks (already known to belong to a single side) to a slice of the base. */
function applyHunks(baseLines: string[], rangeStart: number, rangeEnd: number, hunks: Hunk[]): string[] {
  const sorted = [...hunks].sort((a, b) => a.oldStart - b.oldStart);
  const result: string[] = [];
  let cursor = rangeStart;
  for (const hunk of sorted) {
    const { start, end } = hunkRange(hunk);
    result.push(...baseLines.slice(cursor, start));
    result.push(...hunk.added);
    cursor = end;
  }
  result.push(...baseLines.slice(cursor, rangeEnd));
  return result;
}

export interface MergeCluster {
  /** 0-indexed base line range this cluster covers. */
  baseStart: number;
  baseEnd: number;
  ours: Hunk[];
  theirs: Hunk[];
}

/** Groups Hunks from both sides into clusters, merging any that contend for the same region so a Conflict spans exactly — and only — the overlapping Hunks. */
function clusterHunks(ourHunks: Hunk[], theirHunks: Hunk[]): MergeCluster[] {
  const all: TaggedHunk[] = [
    ...ourHunks.map((hunk): TaggedHunk => ({ hunk, side: "ours" })),
    ...theirHunks.map((hunk): TaggedHunk => ({ hunk, side: "theirs" })),
  ];
  const parent = all.map((_, i) => i);
  function find(i: number): number {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]!]!;
      i = parent[i]!;
    }
    return i;
  }
  function union(i: number, j: number): void {
    const a = find(i);
    const b = find(j);
    if (a !== b) parent[a] = b;
  }
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      if (all[i]!.side === all[j]!.side) continue; // Hunks from the same diff never overlap each other
      if (hunksOverlap(all[i]!.hunk, all[j]!.hunk)) union(i, j);
    }
  }

  const groups = new Map<number, TaggedHunk[]>();
  all.forEach((tagged, i) => {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(tagged);
  });

  const clusters: MergeCluster[] = [];
  for (const group of groups.values()) {
    const ours = group.filter((t) => t.side === "ours").map((t) => t.hunk);
    const theirs = group.filter((t) => t.side === "theirs").map((t) => t.hunk);
    const ranges = group.map((t) => hunkRange(t.hunk));
    clusters.push({
      baseStart: Math.min(...ranges.map((r) => r.start)),
      baseEnd: Math.max(...ranges.map((r) => r.end)),
      ours,
      theirs,
    });
  }
  return clusters.sort((a, b) => a.baseStart - b.baseStart);
}

export interface ThreeWayConflict {
  baseStart: number;
  baseEnd: number;
  ours: Hunk[];
  theirs: Hunk[];
}

export type ThreeWayMergeResult =
  | { conflict: false; text: string }
  | { conflict: true; conflicts: ThreeWayConflict[] };

/**
 * Merges `oursText` and `theirsText`, both descended from `baseText`, at
 * line level. Regions edited by only one side, or edited identically by
 * both, combine automatically; regions where the two sides' Hunks
 * genuinely overlap and disagree are reported as Conflicts.
 */
export function mergeThreeWay(baseText: string, oursText: string, theirsText: string): ThreeWayMergeResult {
  const baseLines = splitLines(baseText);
  const ourHunks = diffLines(baseText, oursText);
  const theirHunks = diffLines(baseText, theirsText);

  if (ourHunks.length === 0) return { conflict: false, text: theirsText };
  if (theirHunks.length === 0) return { conflict: false, text: oursText };

  const clusters = clusterHunks(ourHunks, theirHunks);
  const conflicts: ThreeWayConflict[] = [];
  const resolved: { baseStart: number; baseEnd: number; lines: string[] }[] = [];

  for (const cluster of clusters) {
    if (cluster.ours.length > 0 && cluster.theirs.length > 0) {
      const oursSide = applyHunks(baseLines, cluster.baseStart, cluster.baseEnd, cluster.ours);
      const theirsSide = applyHunks(baseLines, cluster.baseStart, cluster.baseEnd, cluster.theirs);
      const sameLength = oursSide.length === theirsSide.length;
      const identical = sameLength && oursSide.every((line, i) => line === theirsSide[i]);
      if (identical) {
        resolved.push({ baseStart: cluster.baseStart, baseEnd: cluster.baseEnd, lines: oursSide });
      } else {
        conflicts.push({ baseStart: cluster.baseStart, baseEnd: cluster.baseEnd, ours: cluster.ours, theirs: cluster.theirs });
      }
      continue;
    }
    const side = cluster.ours.length > 0 ? cluster.ours : cluster.theirs;
    resolved.push({
      baseStart: cluster.baseStart,
      baseEnd: cluster.baseEnd,
      lines: applyHunks(baseLines, cluster.baseStart, cluster.baseEnd, side),
    });
  }

  if (conflicts.length > 0) {
    return { conflict: true, conflicts };
  }

  let cursor = 0;
  const out: string[] = [];
  for (const region of resolved) {
    out.push(...baseLines.slice(cursor, region.baseStart));
    out.push(...region.lines);
    cursor = region.baseEnd;
  }
  out.push(...baseLines.slice(cursor));
  return { conflict: false, text: joinLines(out) };
}
