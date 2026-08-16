import { describe, expect, it } from "vitest";
import { decodeTree, encodeTree, sortTreeEntries, type TreeEntry } from "../src/engine/tree.js";

const BLOB_ID_A = "a".repeat(40);
const BLOB_ID_B = "b".repeat(40);
const TREE_ID = "c".repeat(40);

describe("Tree entry sort order", () => {
  it("sorts a Blob named 'src.js' before a Tree named 'src' (trailing-slash convention)", () => {
    const entries: TreeEntry[] = [
      { mode: "40000", name: "src", id: TREE_ID },
      { mode: "100644", name: "src.js", id: BLOB_ID_A },
    ];
    const sorted = sortTreeEntries(entries);
    expect(sorted.map((e) => e.name)).toEqual(["src.js", "src"]);
  });

  it("disagrees with naive raw-name sorting for this exact case", () => {
    const entries: TreeEntry[] = [
      { mode: "40000", name: "src", id: TREE_ID },
      { mode: "100644", name: "src.js", id: BLOB_ID_A },
    ];
    const naive = [...entries].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    // Naive sort puts "src" before "src.js" ('.' > nothing); the trailing-slash rule reverses it.
    expect(naive.map((e) => e.name)).toEqual(["src", "src.js"]);
    expect(sortTreeEntries(entries).map((e) => e.name)).toEqual(["src.js", "src"]);
  });

  it("sorts plain names alphabetically otherwise", () => {
    const entries: TreeEntry[] = [
      { mode: "100644", name: "banana", id: BLOB_ID_A },
      { mode: "100644", name: "apple", id: BLOB_ID_B },
    ];
    expect(sortTreeEntries(entries).map((e) => e.name)).toEqual(["apple", "banana"]);
  });
});

describe("Tree codec", () => {
  it("round-trips a Tree with mixed Blob and sub-Tree entries", () => {
    const entries: TreeEntry[] = sortTreeEntries([
      { mode: "100644", name: "src.js", id: BLOB_ID_A },
      { mode: "40000", name: "src", id: TREE_ID },
    ]);
    const decoded = decodeTree(encodeTree(entries));
    expect(decoded).toEqual(entries);
  });

  it("round-trips an empty Tree", () => {
    expect(decodeTree(encodeTree([]))).toEqual([]);
  });

  it("rejects an unsupported mode", () => {
    expect(() => decodeTree(new TextEncoder().encode(`120000 link\0${"0".repeat(20)}`))).toThrow();
  });
});
