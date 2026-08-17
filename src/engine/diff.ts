/** Pure line-level diff. No storage, no Objects — the comparison itself, shared by Commit diffing here and by the three-way merge later. */

/** A contiguous run of changed lines, located by where it falls in each file (CONTEXT.md: Hunk). */
export interface Hunk {
  /** 1-indexed line in the old text this run starts at (or would start at, for a pure insertion). */
  oldStart: number;
  removed: string[];
  /** 1-indexed line in the new text this run starts at (or would start at, for a pure deletion). */
  newStart: number;
  added: string[];
}

function splitLines(text: string): string[] {
  if (text.length === 0) return [];
  const lines = text.split("\n");
  if (lines[lines.length - 1] === "") lines.pop(); // trailing newline is not a line of its own
  return lines;
}

/** longestCommonSubsequence[i][j] = length of the LCS of a[i:] and b[j:]. */
function longestCommonSubsequence(a: string[], b: string[]): number[][] {
  const table: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i]![j] = a[i] === b[j] ? table[i + 1]![j + 1]! + 1 : Math.max(table[i + 1]![j]!, table[i]![j + 1]!);
    }
  }
  return table;
}

/** Aligns two texts by their longest common subsequence of lines and groups the gaps into Hunks. */
export function diffLines(oldText: string, newText: string): Hunk[] {
  const a = splitLines(oldText);
  const b = splitLines(newText);
  const lcs = longestCommonSubsequence(a, b);

  const hunks: Hunk[] = [];
  let current: Hunk | null = null;
  let i = 0;
  let j = 0;

  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      current = null;
      i++;
      j++;
      continue;
    }
    const takeFromOld = j >= b.length || (i < a.length && lcs[i + 1]![j]! >= lcs[i]![j + 1]!);
    if (!current) {
      current = { oldStart: i + 1, removed: [], newStart: j + 1, added: [] };
      hunks.push(current);
    }
    if (takeFromOld) {
      current.removed.push(a[i]!);
      i++;
    } else {
      current.added.push(b[j]!);
      j++;
    }
  }
  return hunks;
}
