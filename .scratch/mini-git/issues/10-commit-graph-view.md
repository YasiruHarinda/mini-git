# 10 — Commit graph view

**What to build:** History on screen as a graph — Branches in lanes, Commits as
nodes, Merge Commits joining two lines. Someone can see divergence and
convergence as shape instead of inferring it from a list of messages.

The graph is a way into the Object Store, not a picture beside it. Clicking a
node selects that Commit, and the rest of the interface follows.

Drawn by hand in SVG from the layout query, with no graph library. The layout
work is already done in ticket 08; this ticket is rendering and interaction
only, and should contain no positioning logic — if positioning logic appears
here, it belongs in the engine.

**Blocked by:** 08 (positions and edges) and 09 (an interface to draw into).

**Status:** ready-for-agent

- [ ] The graph renders Commits as nodes with edges to their Parents
- [ ] Each Branch occupies a visually distinct lane
- [ ] Merge Commits are drawn with both Parent edges visible
- [ ] Branch names and HEAD are marked on the graph
- [ ] Clicking a node selects that Commit and the rest of the interface reflects the selection
- [ ] The graph updates when a Commit, Branch or merge changes history
- [ ] A history too tall for the viewport scrolls within its own container, without the page scrolling sideways
- [ ] No lane or position calculation lives in the interface layer
