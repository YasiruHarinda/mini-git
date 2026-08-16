# 13 — Conflict resolution interface

**What to build:** When a merge conflicts, someone can see exactly what
happened and finish the job. Each conflicted Hunk is shown three ways at once —
the Merge Base version, ours, and theirs — so it is possible to see what *each
side changed*, rather than guessing from two differing files.

Showing the base is the part most tools omit and the reason conflicts feel
arbitrary. With it, a conflict becomes readable: this side added a line, that
side rewrote it.

Resolution is per Hunk, not per file. Choosing a side for one Hunk leaves the
others outstanding, and the merge completes only when none remain.

**Blocked by:** 07 (conflicts to resolve) and 09 (an interface to resolve them
in).

**Status:** ready-for-agent

- [ ] A conflicted merge puts the interface into a state that clearly says a merge is in progress
- [ ] Every conflicted path is listed, with a count of outstanding Hunks
- [ ] Each conflicted Hunk shows the Merge Base version alongside ours and theirs
- [ ] A side can be chosen per Hunk, and unresolved Hunks remain outstanding
- [ ] Progress through the conflicts is visible — how many resolved, how many remain
- [ ] Completing the merge is only possible once every Hunk is resolved
- [ ] The resulting Merge Commit appears in the graph with both Parent edges
- [ ] The merge can be abandoned, returning the Repository to its state before the merge began
- [ ] Delete-versus-modify conflicts are presented in a way that makes the choice clear, since there is no text to compare
