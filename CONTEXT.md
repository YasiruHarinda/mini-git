# Context — Mini Git

Shared language for the version control engine and its X-ray interface.
Glossary only: no implementation, no decisions, no plans. Decisions live in
`docs/adr/`.

## Objects

**Object**
: Anything held in the Object Store. Every Object is named by the hash of its
  own content, which makes Objects immutable by construction — change the
  content and you have a different Object, not a modified one. There are
  exactly three kinds: Blob, Tree, Commit.

**Object ID**
: The hash that names an Object. Not an identifier assigned to the Object;
  the Object *is* its content and the ID is derived from it. Two Objects with
  identical content have identical IDs necessarily, not coincidentally.

**Object Store**
: The collection of all Objects. Append-only in normal use: Objects are added
  and read, never modified in place.

**Blob**
: The contents of a file, and nothing else. A Blob has no name, no path, and
  no history — those belong to the Tree that points at it. Two identical
  files in different directories, or in different Repositories, are the same
  Blob.

**Tree**
: A snapshot of one directory: an ordered list of entries, each pairing a
  name with the Object ID of a Blob or of another Tree. Trees nest, so a Tree
  is the root of a subgraph describing an entire directory hierarchy.

**Commit**
: One Tree, plus the Commit or Commits it followed, plus a message, author
  and time. A Commit records a *whole snapshot* of the project, never a set
  of changes. Diffs are computed between Commits on demand; they are not
  stored.

**Parent**
: A Commit that another Commit followed. Most Commits have one. A Merge
  Commit has two. The very first Commit in a Repository has none.

**Merge Commit**
: A Commit with two Parents, recording that two lines of development were
  brought together. The only place the history graph joins rather than
  branches.

## Structure and history

**Repository**
: An Object Store plus the Refs that give some of its Commits names, plus a
  Working Tree. Everything a Repository knows is contained in those.

**History**
: The graph formed by Commits and their Parents. It is directed and has no
  cycles: a Commit can never become its own ancestor, because its ID depends
  on its Parents' IDs, which were fixed before it existed. Not a list, not a
  timeline — a graph, which is why merging is a graph problem.

**Structural Sharing**
: The property that a new Commit reuses every Object whose content did not
  change, creating new Objects only along the path from the changed file to
  the root. Changing one file deep in a hierarchy creates a handful of new
  Objects, not a new copy of the project. The reason snapshots are affordable.

**Ref**
: A name pointing at a Commit. The only mutable thing in a Repository — the
  Object Store is immutable, and all change is expressed by moving Refs.

**Branch**
: A Ref that advances automatically when a Commit is made while it is
  current. A Branch is a pointer, not a container: it holds no Commits and
  copies nothing. Deleting a Branch removes a name and no history.

**HEAD**
: Which Branch is currently the one being worked on. Answers "where does the
  next Commit attach?"

**Working Tree**
: The files as they currently are — the only part of a Repository a person
  edits directly, and the only part not made of Objects.

## Merging

**Merge Base**
: The most recent Commit reachable from both Branches being merged — their
  nearest common ancestor. Found by walking Parents, not by comparing dates:
  timestamps can be wrong or equal, ancestry cannot. Every three-way
  comparison starts here.

**Conflict**
: A region where a file changed on both Branches since the Merge Base, in
  ways that cannot be combined without choosing. Changes to *different*
  regions of the same file are not a Conflict; only overlap is.

**Hunk**
: A contiguous run of changed lines, together with the unchanged lines around
  it that locate it. The unit at which changes are compared and Conflicts are
  reported — never whole files.

**Three-way Merge**
: Combining two Branches by comparing each against the Merge Base rather than
  against each other. The Merge Base is what makes "who changed this?"
  answerable: without it, two differing files are simply different, with no
  way to tell which side moved.

**Fast-forward**
: The case where the Merge Base *is* the current Branch's Commit — one Branch
  has done nothing the other lacks. Nothing needs merging; the Ref simply
  moves forward. No Merge Commit is created, which is why such merges leave
  no trace in the History graph.

## The Index

**Index**
: The set of changes chosen for the next Commit — a flat, sorted list of
  paths paired with Blob IDs. The Index is deliberately *not* a Tree: Trees
  are built from it at Commit time, folding a flat list into a hierarchy.

  The Index is a third state, not a passing phase. A file can differ in the
  Working Tree, in the Index, and in the last Commit simultaneously, and all
  three versions are real at once.

**Staging**
: Recording a file's current Working Tree content into the Index. Staging
  captures content *at that moment* — editing the file afterwards leaves the
  staged version untouched, which is why a file can appear as both staged and
  modified.

## Out of scope

**Rename**
: A file moved between paths. This project does not record renames, and does
  not detect them either. A move is a delete plus an add.

  Not recording renames is what real git does: renames are inferred
  afterwards by comparing content similarity, not stored. This project simply
  stops before the inference step.

## Unresolved

- **Checkout with uncommitted changes** — does switching Branch carry
  modifications across, refuse, or discard them?
