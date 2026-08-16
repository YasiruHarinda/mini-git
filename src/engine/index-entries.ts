import type { ObjectId } from "./storage/types.js";
import type { TreeEntry } from "./tree.js";

/** One entry of the Index: a full relative path paired with the Blob ID staged for it. */
export interface IndexEntry {
  path: string;
  id: ObjectId;
}

export function sortIndexEntries(entries: readonly IndexEntry[]): IndexEntry[] {
  return [...entries].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

export interface TreeWriteResult {
  id: ObjectId;
  created: boolean;
}

export type TreeWriter = (entries: TreeEntry[]) => Promise<TreeWriteResult>;

/**
 * The commit-time operation: folds the flat Index into nested Trees, one
 * Tree per directory level. Structural Sharing falls out of this for free —
 * a subtree whose entries are unchanged hashes to the same Object ID as
 * before, so `writeTree` reports it as reused rather than created.
 */
export async function foldIndexIntoTree(entries: readonly IndexEntry[], writeTree: TreeWriter): Promise<TreeWriteResult> {
  const direct: TreeEntry[] = [];
  const grouped = new Map<string, IndexEntry[]>();

  for (const entry of entries) {
    const slash = entry.path.indexOf("/");
    if (slash === -1) {
      direct.push({ mode: "100644", name: entry.path, id: entry.id });
      continue;
    }
    const segment = entry.path.slice(0, slash);
    const rest = entry.path.slice(slash + 1);
    const existing = grouped.get(segment);
    if (existing) {
      existing.push({ path: rest, id: entry.id });
    } else {
      grouped.set(segment, [{ path: rest, id: entry.id }]);
    }
  }

  const treeEntries: TreeEntry[] = [...direct];
  for (const [segment, subEntries] of grouped) {
    const sub = await foldIndexIntoTree(subEntries, writeTree);
    treeEntries.push({ mode: "40000", name: segment, id: sub.id });
  }
  return writeTree(treeEntries);
}
