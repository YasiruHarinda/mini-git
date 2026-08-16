import { describe, expect, it } from "vitest";
import { decodeCommit, encodeCommit, type CommitData, type Signature } from "../src/engine/commit.js";

const TREE_ID = "a".repeat(40);
const PARENT_A = "b".repeat(40);
const PARENT_B = "c".repeat(40);

const author: Signature = {
  name: "Test Author",
  email: "author@example.com",
  timestamp: 1_700_000_000,
  timezoneOffsetMinutes: 0,
};
const committer: Signature = {
  name: "Test Committer",
  email: "committer@example.com",
  timestamp: 1_700_000_100,
  timezoneOffsetMinutes: 330, // +05:30
};

describe("Commit codec", () => {
  it("round-trips a root Commit with no Parents", () => {
    const data: CommitData = { tree: TREE_ID, parents: [], author, committer, message: "initial commit" };
    expect(decodeCommit(encodeCommit(data))).toEqual(data);
  });

  it("round-trips a Commit with one Parent", () => {
    const data: CommitData = { tree: TREE_ID, parents: [PARENT_A], author, committer, message: "second commit" };
    expect(decodeCommit(encodeCommit(data))).toEqual(data);
  });

  it("round-trips a Merge Commit with two Parents, in order", () => {
    const data: CommitData = {
      tree: TREE_ID,
      parents: [PARENT_A, PARENT_B],
      author,
      committer,
      message: "merge commit",
    };
    const decoded = decodeCommit(encodeCommit(data));
    expect(decoded.parents).toEqual([PARENT_A, PARENT_B]);
    expect(decoded).toEqual(data);
  });

  it("round-trips a negative timezone offset", () => {
    const westCommitter: Signature = { ...committer, timezoneOffsetMinutes: -420 }; // -07:00
    const data: CommitData = { tree: TREE_ID, parents: [], author, committer: westCommitter, message: "x" };
    expect(decodeCommit(encodeCommit(data))).toEqual(data);
  });

  it("round-trips a multi-line message", () => {
    const data: CommitData = {
      tree: TREE_ID,
      parents: [],
      author,
      committer,
      message: "summary line\n\nbody paragraph with detail.\n",
    };
    expect(decodeCommit(encodeCommit(data))).toEqual(data);
  });

  it("rejects content missing a tree line", () => {
    expect(() =>
      decodeCommit(new TextEncoder().encode(`author x <x@x> 1 +0000\ncommitter x <x@x> 1 +0000\n\nmsg`)),
    ).toThrow();
  });
});
