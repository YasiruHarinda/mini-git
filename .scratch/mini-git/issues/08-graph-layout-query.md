# 08 — Graph layout as an engine query

**What to build:** A query that turns a set of Commits into positioned nodes
and edges — each Branch in its own lane, merges drawn with both Parent edges —
so that history can be rendered as shape rather than text.

This lives in the engine rather than the interface, and that placement is a
deliberate testing decision recorded in the spec. Lane assignment has real edge
cases: merges, multiple roots, and criss-cross histories where two Branches
merge each other. Putting it in the interface would force a second test seam
and a browser harness. As an engine query it stays on the single seam and is
tested as data.

Nothing is drawn in this ticket. The output is positions and edges; ticket 10
renders them.

**Blocked by:** 07 — lane assignment is built once, knowing Merge Commits
exist, rather than built for linear history and retrofitted.

**Status:** ready-for-agent

- [ ] The query maps Commits to nodes with a position and edges to their Parents
- [ ] Commits are ordered topologically — a Commit never appears before an ancestor
- [ ] Each Branch occupies a lane, and a lane is reused once its Branch has been merged
- [ ] A Merge Commit produces two edges, one to each Parent
- [ ] Correct for a history with more than one root Commit
- [ ] Correct for a criss-cross history where two Branches have merged each other
- [ ] The same input always produces the same output — no ordering dependent on iteration order of a map or set
- [ ] The query creates no Objects and mutates nothing
