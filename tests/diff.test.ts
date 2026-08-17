import { describe, expect, it } from "vitest";
import { diffLines } from "../src/engine/diff.js";

describe("diffLines", () => {
  it("produces no Hunks for identical text", () => {
    expect(diffLines("a\nb\nc\n", "a\nb\nc\n")).toEqual([]);
  });

  it("produces no Hunks for two empty strings", () => {
    expect(diffLines("", "")).toEqual([]);
  });

  it("distinguishes an added line from a removed one within one Hunk", () => {
    const hunks = diffLines("a\nb\nc\n", "a\nx\nc\n");
    expect(hunks).toEqual([{ oldStart: 2, removed: ["b"], newStart: 2, added: ["x"] }]);
  });

  it("represents a whole-file addition as a single Hunk with only added lines", () => {
    const hunks = diffLines("", "one\ntwo\n");
    expect(hunks).toEqual([{ oldStart: 1, removed: [], newStart: 1, added: ["one", "two"] }]);
  });

  it("represents a whole-file deletion as a single Hunk with only removed lines", () => {
    const hunks = diffLines("one\ntwo\n", "");
    expect(hunks).toEqual([{ oldStart: 1, removed: ["one", "two"], newStart: 1, added: [] }]);
  });

  it("separates two Hunks with unchanged lines between them", () => {
    const hunks = diffLines("a\nb\nc\nd\ne\n", "a\nX\nc\nY\ne\n");
    expect(hunks).toEqual([
      { oldStart: 2, removed: ["b"], newStart: 2, added: ["X"] },
      { oldStart: 4, removed: ["d"], newStart: 4, added: ["Y"] },
    ]);
  });

  it("represents a pure insertion between unchanged lines with no removed lines", () => {
    const hunks = diffLines("a\nc\n", "a\nb\nc\n");
    expect(hunks).toEqual([{ oldStart: 2, removed: [], newStart: 2, added: ["b"] }]);
  });
});
