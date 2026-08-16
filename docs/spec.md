# Spec — Mini Git

Status: ready-for-agent
Date: 2026-08-16
Vocabulary: [`CONTEXT.md`](../CONTEXT.md) · Decisions: [`docs/adr/`](./adr/)

---

## 1. Problem Statement

Millions of people use git every day and cannot say what a commit is. They
know the commands and not the model, so when git behaves unexpectedly — a
branch "loses" work, a merge conflicts where it seemed it shouldn't, a
checkout refuses — they have no mental model to reason from and fall back on
memorised recovery incantations.

The available ways to fix this all fail in the same way. Tutorials explain the
object model in prose, but prose cannot be poked at; the reader nods and
retains nothing. Git clients hide the model deliberately — that is their job —
so daily use teaches nothing about what is underneath. Git's own plumbing
commands expose everything, but they answer questions you must already know
how to ask, and they return text where the thing being described is a graph.

So the gap is specific: **there is no way to perform a version control
operation and watch what it does to the object graph.** The one thing that
would make the model obvious — seeing Objects appear, seeing which are reused,
watching a flat Index fold into nested Trees — is exactly what every existing
tool either hides or renders as text.

## 2. Solution

A version control engine implementing git's real object model — Blobs, nested
Trees, Commits, Refs, an Index, three-way merge — paired with an interface
whose only job is to make the Object Store visible while you manipulate it.

Two properties carry it.

**It is really git, verifiably.** Objects are encoded byte-identically to real
git, so Object IDs match `git hash-object` exactly, and a repository the tool
creates can be read by real `git log`. Correctness is not asserted, it is
demonstrated against the reference implementation.

**The internals are the interface.** Every panel is a window onto the object
graph. Staging a file shows a flat list growing; committing shows that list
fold into a hierarchy; a second commit shows four new Objects appear beside
dozens reused unchanged. The claim "version control stores snapshots
affordably through structural sharing" is never made in prose, because the
screen shows it happening.

## 3. User Stories

### Seeing the Object Store

1. As someone learning git, I want to see every Object created by an action, so that I can connect a command to its effect rather than memorising the command.
2. As someone learning git, I want to click a Commit and see the Tree it points at, so that I can follow the chain from history to actual file contents.
3. As someone learning git, I want to walk from a Tree into its sub-Trees and down to Blobs, so that I can see that a directory hierarchy is made of Objects pointing at Objects.
4. As someone learning git, I want every Object ID visible next to its Object, so that hashes stop being opaque noise and become addresses.
5. As someone learning git, I want to see the content of a Blob, so that I can confirm a Blob really is just file bytes with no name and no history.
6. As someone learning git, I want Objects created by the latest action marked distinctly from Objects reused unchanged, so that Structural Sharing is something I observe rather than something I am told.
7. As someone learning git, I want to see how many unique Blobs exist against how many file versions have been committed, so that I understand why storing whole snapshots is affordable.
8. As someone learning git, I want to see two identical files in different directories resolve to one Blob, so that content addressing stops being abstract.
9. As someone learning git, I want to see the full list of Refs at once, so that I can see a Branch is a single pointer and not a container of Commits.
10. As someone learning git, I want to see which Ref HEAD points at, so that "where am I?" has a visible answer.

### Working Tree and Index

11. As a user, I want to create a file in the Working Tree, so that I have something to version.
12. As a user, I want to edit a file's contents, so that I can produce a change worth committing.
13. As a user, I want to delete a file, so that I can see how removal is recorded.
14. As a user, I want to stage a file, so that I can choose what goes into the next Commit.
15. As a user, I want to unstage a file, so that I can correct a staging mistake without losing my edits.
16. As someone learning git, I want the Working Tree, Index and last Commit shown as three distinct states side by side, so that I can see all three versions of a file existing at once.
17. As someone learning git, I want to stage a file and then edit it again, so that I can see the same file appear as both staged and modified and finally understand why that happens.
18. As someone learning git, I want the Index displayed as the flat sorted list of paths and Blob IDs it actually is, so that I stop imagining it as a folder.
19. As someone learning git, I want to watch the flat Index fold into nested Trees at the moment I commit, so that I can see what committing actually does.

### Committing and history

20. As a user, I want to commit staged changes with a message, so that I can record a snapshot.
21. As a user, I want the new Commit's Object ID shown immediately, so that I can find it again in the graph.
22. As someone learning git, I want to see that a Commit references a whole Tree rather than a set of changes, so that I understand snapshots are stored and diffs are computed.
23. As a user, I want to see the history as a list with messages, IDs and times, so that I can scan what happened.
24. As a user, I want to see the history as a graph, so that divergence and convergence are visible as shape rather than inferred from text.
25. As a user, I want each Branch to occupy its own lane in the graph, so that I can follow one line of development with my eye.
26. As a user, I want a Merge Commit drawn with both of its Parent edges, so that the join is visible.
27. As a user, I want to click any node in the graph and inspect that Commit's Objects, so that the graph is a way into the store rather than a picture beside it.
28. As someone learning git, I want to see that history is a graph rather than a timeline, so that I understand why merging is a graph problem.

### Branching and checkout

29. As a user, I want to create a Branch, so that I can work without disturbing the main line.
30. As a user, I want to see that creating a Branch produces no new Objects at all, so that I learn branching is free.
31. As a user, I want to check out a Branch, so that I can move between lines of work.
32. As a user, I want the Working Tree to change to match the Branch I checked out, so that checkout has a visible effect.
33. As a user, I want to be refused a checkout that would overwrite uncommitted changes, so that I cannot silently lose work.
34. As a user, I want to see the refusal explain which files are in the way, so that I know what to commit or discard.
35. As a user, I want to commit on two Branches and see them diverge in the graph, so that I can set up the situation merging exists to resolve.

### Merging

36. As a user, I want to merge one Branch into another, so that two lines of work become one.
37. As someone learning git, I want the Merge Base identified and shown before the merge runs, so that I can see the merge is anchored on a common ancestor rather than a comparison of two tips.
38. As a user, I want a merge with no divergence to fast-forward, so that trivial merges stay trivial.
39. As someone learning git, I want a fast-forward to visibly create no Merge Commit, so that I understand why some merges leave no trace.
40. As a user, I want two Branches that edited different Hunks of the same file to merge automatically, so that I am not asked to resolve changes that do not actually collide.
41. As a user, I want a Conflict reported only where Hunks genuinely overlap, so that conflicts are precise rather than whole-file surrender.
42. As a user, I want to see a Conflict presented with the Merge Base version alongside both sides, so that I can see what each side changed rather than guessing.
43. As a user, I want to resolve a Conflict by choosing one side, so that I can complete the merge.
44. As a user, I want a file deleted on one Branch and modified on the other to be reported as a Conflict, so that a deletion cannot silently discard someone's work.
45. As a user, I want the same file added on both Branches with different contents to be reported as a Conflict, so that concurrent creation is handled.
46. As a user, I want the same file added on both Branches with identical contents to merge silently, so that agreement is not treated as disagreement.
47. As a user, I want the completed merge to produce a Commit with two Parents, so that the history records that a join happened.

### Diff

48. As a user, I want a diff between any two Commits, so that I can see what changed without reading two snapshots.
49. As a user, I want diffs shown at line level with additions and removals distinguished, so that changes are legible.
50. As someone learning git, I want the diff labelled as computed rather than stored, so that the snapshot model stays clear.

### Trust and verification

51. As a developer evaluating this project, I want Object IDs to match real git's for the same content, so that I can verify the implementation against something other than its own tests.
52. As a developer evaluating this project, I want a test suite that asserts against real git's output, so that correctness is demonstrated rather than claimed.
53. As a developer evaluating this project, I want the engine to contain no reference to files or browsers, so that I can see the boundary was drawn deliberately.
54. As a CLI user, I want to run the tool in a terminal against real files on disk, so that it is a real tool and not only a simulation.
55. As a CLI user, I want to export a repository as a real git directory, so that I can run actual `git log` against something my tool produced.

### The deployed demo

56. As a first-time visitor, I want a repository with existing history already loaded, so that the graph and the Object Store are worth looking at within a second of arriving.
57. As a first-time visitor, I want a preloaded scenario that is already mid-conflict, so that I can reach the most interesting behaviour without constructing it myself.
58. As a visitor, I want to reset to the initial state, so that I can experiment freely without fear of ruining the demo.

## 4. Implementation Decisions

### Governing decisions

Three ADRs govern this work and are not reopened here: objects are encoded
byte-identically to real git ([ADR 0001](./adr/0001-git-identical-object-encoding.md)),
the engine is pure with pluggable storage ([ADR 0002](./adr/0002-pure-engine-with-pluggable-storage.md)),
and the interface is an X-ray rather than a git client ([ADR 0003](./adr/0003-the-ui-is-an-x-ray-not-a-client.md)).

### Modules

- **Object codec** — serialises and parses Blobs, Trees and Commits in git's exact format, and computes Object IDs. Owns the tree entry sort rule, including the trailing-slash convention for directory names.
- **Object Store** — reads and writes Objects by ID through the storage interface. Append-only.
- **Storage adapters** — an in-memory adapter backed by browser storage, and a filesystem adapter. The filesystem adapter additionally writes zlib-compressed loose objects in git's directory layout.
- **Index** — the flat sorted list of paths to Blob IDs, and the operation that folds it into nested Trees at Commit time.
- **Refs** — named pointers, including HEAD. The only mutable state in a Repository.
- **Diff** — longest-common-subsequence line diff between two Blobs, and recursive Tree comparison to determine which paths changed between two Commits.
- **Merge** — Merge Base discovery by breadth-first ancestry walk, three-way combination per path, and Conflict reporting at Hunk level.
- **Graph layout** — a pure query mapping a set of Commits to positioned nodes and edges. Lives in the engine, not the interface; see Testing Decisions.
- **Repository API** — the single public surface composing the above. Everything outside the engine goes through it.
- **CLI** — a thin argument parser over the Repository API against the filesystem adapter.
- **Web interface** — a view over the Repository API against the in-memory adapter.

### The storage seam

The interface between engine and storage, which encodes ADR 0002 more
precisely than prose can. It is deliberately tiny; a third adapter should be
easy to write, and that is the test of whether it is really an interface.

```ts
interface ObjectStorage {
  read(id: ObjectId): Promise<Uint8Array | null>;
  write(id: ObjectId, bytes: Uint8Array): Promise<void>;
  has(id: ObjectId): Promise<boolean>;
  listRefs(): Promise<Map<RefName, ObjectId>>;
  setRef(name: RefName, id: ObjectId): Promise<void>;
  deleteRef(name: RefName): Promise<void>;
  readHead(): Promise<RefName>;
  writeHead(name: RefName): Promise<void>;
}
```

No path, no `fs` call and no browser API may appear above this line. Any
convenience that leaks one destroys the property the interface exists to
create.

### Repository API

The single seam. Commands: `init`, `add`, `unstage`, `commit`, `log`,
`branch`, `checkout`, `merge`, `resolve`, `diff`. Queries: read an Object by
ID, list Refs, read HEAD, read the Index, read the Working Tree, read graph
layout, and report Object Store statistics for the dedup counter.

Every query returns whether each Object in its result was newly created by the
most recent operation or reused, since Structural Sharing must be visible in
the interface (user story 6) and only the engine knows the answer.

### Merge case matrix

| Base | Ours | Theirs | Result |
|---|---|---|---|
| present | unchanged | unchanged | keep base |
| present | changed | unchanged | take ours |
| present | unchanged | changed | take theirs |
| present | changed | changed, non-overlapping Hunks | combine automatically |
| present | changed | changed, overlapping Hunks | **Conflict** |
| present | deleted | changed | **Conflict** |
| present | changed | deleted | **Conflict** |
| present | deleted | deleted | delete |
| absent | added | absent | take ours |
| absent | added | added, identical content | take either |
| absent | added | added, differing content | **Conflict** |

Fast-forward is detected before any of this: when the Merge Base is the
current Branch's Commit, the Ref moves and no Merge Commit is created.

### Checkout semantics

Checkout refuses when the Working Tree holds uncommitted changes that the
switch would overwrite, matching git, and names the offending paths. Changes
to files that do not differ between the two Commits are carried across
untouched. This resolves the last open term in `CONTEXT.md`.

### Interface composition

A single screen, no routing: Working Tree / Index / Commit as three columns; a
file editor; the Commit graph; an Object inspector that walks Commit to Tree
to Blob; a diff view; an Object Store statistics line. Conflict resolution
presents Merge Base, ours and theirs together. An in-browser terminal accepts
the same commands the CLI does.

## 5. Testing Decisions

### What makes a good test here

A test drives the Repository API and asserts on observable results — Object
IDs, Ref positions, Working Tree contents, Index contents, Conflict reports,
graph shape. It never reaches into tree construction, ancestry walking or
diff internals. Those are reachable through the public surface, so testing
them directly would only couple the suite to decisions we want to stay free
to change.

Tests are written in the vocabulary of `CONTEXT.md`. A test named for a
Merge Base or a Hunk survives a refactor; one named for a function does not.

### Seams

**One seam: the Repository API.** Every behavioural test enters here. Two
notes on why this holds rather than being aspirational:

- **The differential oracle is the same seam.** Comparing Object IDs against real `git` uses the Repository API through the filesystem adapter, with an external subprocess supplying the expected value. It adds an assertion source, not an entry point.
- **Graph layout lives in the engine for this reason.** Positioning Commits into lanes is real logic with real edge cases — merges, multiple roots, criss-cross histories. Placing it in the interface would force a second seam and a browser test harness. As an engine query it stays on the first seam and is tested as data rather than pixels.

The interface gets no test seam. It is a view over engine state, and it must
stay thin enough that this remains true; logic appearing there is a signal it
belongs in the engine.

### Coverage

- **Object codec** — round-trip all three Object types; entry sort order including the directory trailing-slash trap; empty Blob; empty Tree.
- **Differential against real git** — Object IDs for Blobs, Trees and Commits compared to `git hash-object` and `git mktree`, plus an end-to-end check that real `git log` reads an exported repository.
- **Index and commit** — staging captures content at that moment; a file staged then edited appears in both states; the flat Index produces correct nested Trees.
- **Structural Sharing** — changing one deep file creates exactly the expected number of new Objects and reuses the rest. This is the project's central claim, so it is asserted numerically.
- **Refs and checkout** — branching creates no Objects; checkout rewrites the Working Tree; checkout refuses when changes would be lost and names the paths.
- **Merge** — Merge Base discovery across linear, diverged, and multi-merge histories; every row of the case matrix; fast-forward creating no Merge Commit; a completed merge having two Parents.
- **Diff** — line-level additions and removals; identical inputs producing an empty diff; whole-file addition and deletion.
- **Graph layout** — lane assignment for diverged and merged histories; stable output for the same input.

### Prior art

None. This is a greenfield repository, so this spec establishes the
convention rather than following one. Node's test runner or Vitest against
the filesystem adapter; the differential tests require real git on the machine
and should skip with a clear message rather than fail where it is absent.

## 6. Out of Scope

- **Renames.** Not recorded and not detected; a move is a delete plus an add. Closed in `CONTEXT.md`.
- **Remotes and networking.** No clone, fetch, push or pull. Nothing distributed.
- **Packfiles and delta compression.** Loose objects only. zlib is used on the export path solely for git compatibility, not as a storage strategy.
- **Rebase, stash, cherry-pick, reflog, tags, submodules, hooks, `.gitignore`.**
- **File modes beyond regular files.** No executable bit handling, symlinks or binary-safe diffing.
- **SHA-256 object format.** SHA-1 only, because compatibility with the installed git is the point of ADR 0001.
- **Accounts, authentication, persistence across devices, multi-user access.**
- **Hosted per-user filesystems.** Rejected in ADR 0002.
- **Being a usable git client.** Rejected in ADR 0003; the README must set this frame in its first sentence.

## 7. Further Notes

### Build order

Sequenced so that abandoning at any point still leaves something demonstrable
— the failure mode for a multi-week evening project is attrition, not hours.

| | Cumulative | Lands | Demonstrable as |
|---|---|---|---|
| 1 | 8h | Object codec, store, storage seam, filesystem adapter, differential tests | Test output showing IDs matching real git |
| 2 | 17h | init, add, commit, log, Refs, branch, checkout, HEAD | A terminal session building real history |
| 3 | 24h | Diff, Merge Base, three-way merge, Conflicts, fast-forward | The centrepiece, complete before any interface exists |
| 4 | 37h | Interface: graph, Object inspector, diff view, editor, three columns; deployed | The public link |
| 5 | 47h | Conflict resolution UI, in-browser terminal, git export, README | The full thing |

Push the README at checkpoint 3 so the repository is presentable from the
halfway mark.

### Known traps

Tree entry sort order is the likely time sink: entries sort as though
directory names carry a trailing slash, so `src.js` precedes `src/` against
what a naive comparison gives. Object IDs will disagree with git until this is
exactly right, and the differential tests will catch it immediately — which is
the argument for building them first.

### Assumed stack

Vite, React, TypeScript. Hand-rolled SVG for the graph, laid out by
topological order against Branch lane; no graph library. Preloaded demo
repositories so the deployed link is never empty.
