# 07 — Three-way merge and the full conflict matrix

**What to build:** Two Branches that both edited the same file merge cleanly,
provided they edited different parts of it. Where their edits genuinely
overlap, the merge stops and reports a Conflict at Hunk level rather than
surrendering the whole file.

This is the centrepiece of the project. Everything before it exists to make it
possible; everything after it makes it visible.

Each path is decided by comparing both sides against the Merge Base — never
against each other. Without the base, two differing files are simply different,
with no way to tell which side moved. The full matrix:

| Base | Ours | Theirs | Result |
|---|---|---|---|
| present | unchanged | unchanged | keep base |
| present | changed | unchanged | take ours |
| present | unchanged | changed | take theirs |
| present | changed | changed, non-overlapping Hunks | combine |
| present | changed | changed, overlapping Hunks | **Conflict** |
| present | deleted | changed | **Conflict** |
| present | changed | deleted | **Conflict** |
| present | deleted | deleted | delete |
| absent | added | absent | take ours |
| absent | added | added, identical | take either |
| absent | added | added, differing | **Conflict** |

A merge that conflicts must leave the Repository in a resolvable state — not
half-committed, and not rolled back so far that the work of finding the
conflicts is lost.

**Blocked by:** 05 (line comparison) and 06 (Merge Base, fast-forward
detection).

**Status:** ready-for-agent

- [ ] Two Branches editing different Hunks of the same file merge automatically, with no Conflict reported
- [ ] Two Branches editing overlapping Hunks report a Conflict, and only that region is conflicted
- [ ] Every row of the matrix above is covered by a test
- [ ] Conflicts are reported with the path, the conflicting Hunks, and the Merge Base version alongside both sides
- [ ] A clean merge produces a Commit with exactly two Parents
- [ ] A conflicted merge creates no Commit and leaves the Repository resolvable
- [ ] Resolving each Conflict by choosing a side allows the merge to be completed
- [ ] Merging produces correct results when the two Branches touched entirely disjoint sets of files
- [ ] Real `git log` reads a history containing a Merge Commit created this way
