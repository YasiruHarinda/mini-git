import { describe, expect, it } from "vitest";
import { mergeThreeWay } from "../src/engine/merge.js";

describe("mergeThreeWay", () => {
  it("returns the base text unchanged when neither side edited it", () => {
    const result = mergeThreeWay("a\nb\nc\n", "a\nb\nc\n", "a\nb\nc\n");
    expect(result).toEqual({ conflict: false, text: "a\nb\nc\n" });
  });

  it("takes ours whole when theirs made no edits at all", () => {
    const result = mergeThreeWay("a\nb\n", "A\nb\n", "a\nb\n");
    expect(result).toEqual({ conflict: false, text: "A\nb\n" });
  });

  it("takes theirs whole when ours made no edits at all", () => {
    const result = mergeThreeWay("a\nb\n", "a\nb\n", "a\nB\n");
    expect(result).toEqual({ conflict: false, text: "a\nB\n" });
  });

  it("combines edits to different lines with no Conflict", () => {
    const base = "one\ntwo\nthree\nfour\nfive\n";
    const ours = "ONE\ntwo\nthree\nfour\nfive\n";
    const theirs = "one\ntwo\nthree\nfour\nFIVE\n";
    const result = mergeThreeWay(base, ours, theirs);
    expect(result).toEqual({ conflict: false, text: "ONE\ntwo\nthree\nfour\nFIVE\n" });
  });

  it("reports a Conflict when both sides edit the same line differently", () => {
    const base = "one\ntwo\n";
    const ours = "ONE\ntwo\n";
    const theirs = "one-alt\ntwo\n";
    const result = mergeThreeWay(base, ours, theirs);
    expect(result.conflict).toBe(true);
    if (!result.conflict) throw new Error("unreachable");
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0]!.ours[0]!.added).toEqual(["ONE"]);
    expect(result.conflicts[0]!.theirs[0]!.added).toEqual(["one-alt"]);
  });

  it("does not conflict when both sides make the identical edit", () => {
    const base = "one\ntwo\n";
    const ours = "ONE\ntwo\n";
    const theirs = "ONE\ntwo\n";
    const result = mergeThreeWay(base, ours, theirs);
    expect(result).toEqual({ conflict: false, text: "ONE\ntwo\n" });
  });

  it("scopes the Conflict to only the overlapping region, combining the rest", () => {
    const base = "one\ntwo\nthree\nfour\nfive\n";
    const ours = "ONE-A\ntwo\nthree\nfour\nFIVE\n";
    const theirs = "ONE-B\ntwo\nthree\nfour\nFIVE\n";
    const result = mergeThreeWay(base, ours, theirs);
    expect(result.conflict).toBe(true);
    if (!result.conflict) throw new Error("unreachable");
    expect(result.conflicts).toHaveLength(1); // "five" -> "FIVE" agreed on both sides, so it is not a second Conflict
    expect(result.conflicts[0]!.ours[0]!.added).toEqual(["ONE-A"]);
  });

  it("reports a Conflict when both sides insert differing content at the same empty point", () => {
    const result = mergeThreeWay("", "ours content\n", "theirs content\n");
    expect(result.conflict).toBe(true);
    if (!result.conflict) throw new Error("unreachable");
    expect(result.conflicts).toHaveLength(1);
  });

  it("combines when both sides insert identical content at the same empty point", () => {
    const result = mergeThreeWay("", "same content\n", "same content\n");
    expect(result).toEqual({ conflict: false, text: "same content\n" });
  });

  it("combines adjacent, non-overlapping insertions from both sides", () => {
    const base = "a\nb\n";
    const ours = "a\nX\nb\n";
    const theirs = "a\nb\nY\n";
    const result = mergeThreeWay(base, ours, theirs);
    expect(result).toEqual({ conflict: false, text: "a\nX\nb\nY\n" });
  });
});
