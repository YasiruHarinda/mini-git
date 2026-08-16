# 09 — Web shell: three columns, editor, staging — deployed

**What to build:** The first public link. Someone opens a URL and can create
and edit files, stage them, and commit — with the Working Tree, the Index and
the last Commit shown side by side as three distinct states.

The three columns are the point. A file can differ in all three places at
once, and seeing that is what finally explains why a file can appear as both
staged and modified. The Index column shows the flat sorted list of paths and
Blob IDs it actually is, so nobody comes away imagining it as a folder.

Per ADR 0003 this is not a git client and should not be arranged like one:
where a client would hide an Object ID, this shows it.

This ticket deliberately does not wait for merge. The link exists as soon as
the engine can commit, and every later interface ticket redeploys on top of it.

**Blocked by:** 03 — needs a Repository that can stage and commit. Explicitly
not blocked by merge.

**Status:** ready-for-agent

- [ ] The application runs against the in-memory adapter with no backend
- [ ] Files can be created, edited and deleted in the Working Tree
- [ ] Files can be staged and unstaged
- [ ] Working Tree, Index and last Commit are shown as three distinct columns
- [ ] A file staged and then edited appears in the Working Tree and Index columns with different content, visibly
- [ ] The Index column displays paths paired with Blob IDs, as a flat sorted list
- [ ] Committing with a message updates all three columns and shows the new Commit's Object ID
- [ ] Object IDs are shown wherever they exist, not hidden
- [ ] The application is deployed and reachable at a public URL
- [ ] The page renders correctly in both light and dark themes
