import { describe, expect, it } from "vitest";
import { foldIndexIntoTree, sortIndexEntries, type IndexEntry } from "../src/engine/index-entries.js";
import type { TreeEntry } from "../src/engine/tree.js";

const BLOB = (n: number) => n.toString(16).padStart(40, "0");

describe("Index: sorting", () => {
  it("sorts entries by full path", () => {
    const entries: IndexEntry[] = [
      { path: "b.txt", id: BLOB(1) },
      { path: "a.txt", id: BLOB(2) },
    ];
    expect(sortIndexEntries(entries).map((e) => e.path)).toEqual(["a.txt", "b.txt"]);
  });
});

describe("Index: folding into nested Trees", () => {
  it("builds a single flat Tree for entries with no directories", async () => {
    const entries: IndexEntry[] = [{ path: "a.txt", id: BLOB(1) }];
    const writes: TreeEntry[][] = [];
    await foldIndexIntoTree(entries, async (treeEntries) => {
      writes.push(treeEntries);
      return { id: "root".padEnd(40, "0"), created: true };
    });
    expect(writes).toHaveLength(1);
    expect(writes[0]).toEqual([{ mode: "100644", name: "a.txt", id: BLOB(1) }]);
  });

  it("recurses one Tree per directory level, deepest first", async () => {
    const entries: IndexEntry[] = [{ path: "src/deep/file.js", id: BLOB(1) }];
    const writes: TreeEntry[][] = [];
    let counter = 0;
    await foldIndexIntoTree(entries, async (treeEntries) => {
      writes.push(treeEntries);
      counter += 1;
      return { id: counter.toString().padStart(40, "0"), created: true };
    });
    // deep/file.js, then src/deep, then the root — three Tree writes for three levels.
    expect(writes).toHaveLength(3);
    expect(writes[0]).toEqual([{ mode: "100644", name: "file.js", id: BLOB(1) }]);
    expect(writes[1]).toEqual([{ mode: "40000", name: "deep", id: "1".padStart(40, "0") }]);
    expect(writes[2]).toEqual([{ mode: "40000", name: "src", id: "2".padStart(40, "0") }]);
  });

  it("mixes direct file entries and subdirectory entries at the same level", async () => {
    const entries: IndexEntry[] = [
      { path: "README.md", id: BLOB(1) },
      { path: "src/main.js", id: BLOB(2) },
    ];
    const writes: TreeEntry[][] = [];
    await foldIndexIntoTree(entries, async (treeEntries) => {
      writes.push(treeEntries);
      return { id: writes.length.toString().padStart(40, "0"), created: true };
    });
    const rootWrite = writes[writes.length - 1]!;
    expect(rootWrite.find((e) => e.name === "README.md")).toBeTruthy();
    expect(rootWrite.find((e) => e.name === "src")?.mode).toBe("40000");
  });
});
