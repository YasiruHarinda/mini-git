# 06 — Merge Base discovery and fast-forward

**What to build:** Given two Branches, the system can name their nearest common
ancestor, and can recognise the case where no real merging is needed at all.

Finding the Merge Base is an ancestry walk, not a date comparison. Timestamps
can be wrong, equal, or deliberately forged; ancestry cannot. A test with
misleading timestamps is worth writing precisely because the naive
implementation passes everything else.

Fast-forward is the second half: when the Merge Base *is* the current Branch's
Commit, that Branch has done nothing the other lacks, so the Ref simply moves
and no Merge Commit is created. This is why some merges leave no trace in the
graph, and it should be visibly true — zero new Objects.

**Blocked by:** 04 — needs Branches that can diverge.

**Status:** done

- [x] The Merge Base of two Branches is found by walking Parents
- [x] Correct on a linear history, on a diverged history, and on a history that already contains a Merge Commit
- [x] Correct when Commit timestamps are misleading — out of order or identical — proving dates are not being used
- [x] Merging a Branch whose Commit is already an ancestor of the current one is a no-op and says so
- [x] When the Merge Base is the current Branch's Commit, the Ref moves forward and no Merge Commit is created
- [x] A fast-forward creates zero new Objects, asserted as a count
- [x] The Merge Base is reported to the caller, not just used internally — the interface needs to show it later
