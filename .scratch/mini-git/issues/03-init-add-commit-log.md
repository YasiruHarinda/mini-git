# 03 — `init`, `add`, `commit` and `log` through the Repository API

**What to build:** Someone sits at a terminal, creates a repository, edits
files, stages some of them, commits, and reads back the history. At the end of
this ticket the project is a working version control system — everything after
it either extends what history can look like or makes it visible.

The behaviour that matters most here is the Index. It is a flat sorted list of
paths to Blob IDs, not a Tree, and it captures content at the moment of
staging. Committing is the operation that folds that flat list into nested
Trees. A file staged and then edited again is genuinely in two states at once,
and that has to be observable rather than smoothed over.

Structural Sharing becomes assertable in this ticket and should be pinned down
with a number: changing one file deep in a hierarchy creates Objects only along
the path from that file to the root, and reuses everything else.

**Blocked by:** 02 — needs Trees and Commits.

**Status:** ready-for-agent

- [ ] `init` creates an empty Repository with HEAD pointing at a default Branch that has no Commits yet
- [ ] `add` records the current Working Tree content of a path into the Index; editing the file afterwards leaves the staged content untouched
- [ ] `unstage` removes a path from the Index without touching the Working Tree
- [ ] The Index is observably a flat sorted list of paths to Blob IDs
- [ ] `commit` builds nested Trees from the flat Index, creates a Commit, and advances the current Branch
- [ ] Committing with an empty Index is refused with a message saying why
- [ ] Changing one file three directories deep creates exactly the Objects along that path and reuses the rest, asserted as a count
- [ ] Two identical files at different paths resolve to a single Blob
- [ ] `log` walks Parents from HEAD and reports message, Object ID and time
- [ ] A command line tool drives all of the above against real files on disk
- [ ] Real `git log` reads the resulting repository and shows the same history
