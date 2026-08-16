# 12 — Diff view in the interface

**What to build:** Someone selects two Commits and sees what changed between
them, line by line, with additions and removals distinguished.

The framing matters as much as the rendering. This diff was computed on
request; it is not stored anywhere and no Object represents it. The interface
should say so, because the whole point of showing the object graph alongside
is that a viewer can check: the diff appeared, and the Object Store did not
change.

**Blocked by:** 05 (the diff itself) and 09 (an interface to render it in).

**Status:** ready-for-agent

- [ ] Two Commits can be selected for comparison, defaulting to a Commit against its Parent
- [ ] Changed paths are listed, with added, removed and modified distinguished
- [ ] Selecting a changed path shows a line-level diff
- [ ] Additions and removals are distinguished by more than colour alone
- [ ] The view states that the diff is computed rather than stored
- [ ] Viewing a diff creates no Objects, and the statistics line visibly does not move
- [ ] Long lines and long files scroll within the diff container, without the page scrolling sideways
- [ ] Comparing a Commit with itself shows an explicit empty state rather than a blank panel
