import { describe, expect, it } from "vitest";
import { hashObject } from "../src/engine/codec.js";
import { encodeCommit, type CommitData, type Signature } from "../src/engine/commit.js";
import { encodeTree, sortTreeEntries, type TreeEntry } from "../src/engine/tree.js";
import { hasRealGit, realGitCommitTree, realGitHashObject, realGitMktree } from "./support/real-git.js";

describe.skipIf(!hasRealGit())("Differential: Tree Object ID vs real git", () => {
  it("matches git mktree for a flat Tree of two Blobs", () => {
    const blobA = realGitHashObject(new TextEncoder().encode("content a"));
    const blobB = realGitHashObject(new TextEncoder().encode("content b"));
    const entries: TreeEntry[] = sortTreeEntries([
      { mode: "100644", name: "a.txt", id: blobA },
      { mode: "100644", name: "b.txt", id: blobB },
    ]);
    const ours = hashObject("tree", encodeTree(entries));
    const theirs = realGitMktree(entries);
    expect(ours).toBe(theirs);
  });

  it("matches git mktree for the src.js / src/ trailing-slash trap", () => {
    const blob = realGitHashObject(new TextEncoder().encode("blob content"));
    const innerTree = realGitMktree([{ mode: "100644", name: "main.js", id: blob }]);
    const entries: TreeEntry[] = sortTreeEntries([
      { mode: "100644", name: "src.js", id: blob },
      { mode: "40000", name: "src", id: innerTree },
    ]);
    const ours = hashObject("tree", encodeTree(entries));
    const theirs = realGitMktree(entries);
    expect(ours).toBe(theirs);
  });

  it("matches git mktree for an empty Tree", () => {
    const ours = hashObject("tree", encodeTree([]));
    const theirs = realGitMktree([]);
    expect(ours).toBe(theirs);
  });
});

describe.skipIf(!hasRealGit())("Differential: Commit Object ID vs real git", () => {
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
    timezoneOffsetMinutes: 330,
  };

  it("matches git commit-tree for a root Commit", () => {
    const tree = realGitMktree([]);
    const data: CommitData = { tree, parents: [], author, committer, message: "root commit" };
    const ours = hashObject("commit", encodeCommit(data));
    const theirs = realGitCommitTree(
      tree,
      [],
      "root commit",
      { name: author.name, email: author.email, date: "1700000000 +0000" },
      { name: committer.name, email: committer.email, date: "1700000100 +0530" },
    );
    expect(ours).toBe(theirs);
  });

  it("matches git commit-tree for a Commit with one Parent", () => {
    const tree = realGitMktree([]);
    const parent = realGitCommitTree(
      tree,
      [],
      "parent commit",
      { name: author.name, email: author.email, date: "1700000000 +0000" },
      { name: committer.name, email: committer.email, date: "1700000000 +0000" },
    );
    const data: CommitData = { tree, parents: [parent], author, committer, message: "child commit" };
    const ours = hashObject("commit", encodeCommit(data));
    const theirs = realGitCommitTree(
      tree,
      [parent],
      "child commit",
      { name: author.name, email: author.email, date: "1700000000 +0000" },
      { name: committer.name, email: committer.email, date: "1700000100 +0530" },
    );
    expect(ours).toBe(theirs);
  });

  it("matches git commit-tree for a Merge Commit with two Parents", () => {
    const tree = realGitMktree([]);
    const mkParent = (msg: string) =>
      realGitCommitTree(
        tree,
        [],
        msg,
        { name: author.name, email: author.email, date: "1700000000 +0000" },
        { name: committer.name, email: committer.email, date: "1700000000 +0000" },
      );
    const parentA = mkParent("parent a");
    const parentB = mkParent("parent b");
    const data: CommitData = { tree, parents: [parentA, parentB], author, committer, message: "merge" };
    const ours = hashObject("commit", encodeCommit(data));
    const theirs = realGitCommitTree(
      tree,
      [parentA, parentB],
      "merge",
      { name: author.name, email: author.email, date: "1700000000 +0000" },
      { name: committer.name, email: committer.email, date: "1700000100 +0530" },
    );
    expect(ours).toBe(theirs);
  });
});

if (!hasRealGit()) {
  console.warn("Skipping differential Tree/Commit tests: real git not found on PATH.");
}
