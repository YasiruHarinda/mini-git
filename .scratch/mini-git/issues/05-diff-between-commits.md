# 05 — Diff between two Commits

**What to build:** Someone can ask what changed between any two Commits and get
an answer at line level, with additions and removals distinguished. This is
useful on its own, and it is also half of merge — the three-way combination in
ticket 07 is built on the same line comparison.

The diff is computed, never stored. No Object is created by asking for one, and
that should be true observably, not just by intention.

Finding *which* paths changed is a recursive Tree comparison rather than a
listing of every file: when two Trees have the same Object ID, nothing beneath
them can differ, so the walk stops there. That shortcut is the payoff of
Structural Sharing and is worth asserting.

**Blocked by:** 03 — needs Commits to compare.

**Status:** done

- [x] Diffing two Commits reports changed paths, with added, removed and modified distinguished
- [x] Line-level diff within a modified file distinguishes added lines from removed ones
- [x] Subtrees with identical Object IDs are not walked into, asserted rather than assumed
- [x] Diffing a Commit against itself produces an empty result
- [x] Whole-file addition and whole-file deletion are each represented correctly
- [x] A file moved between directories reports as a deletion plus an addition, matching the out-of-scope decision on renames
- [x] No Object is created by computing a diff, asserted as a count
- [x] `diff` is available from the command line
