# 15 — Preloaded demo scenarios and reset

**What to build:** The deployed link is never empty. Someone arriving for the
first time finds a Repository that already has history worth looking at — a
graph with a branch in it, an Object Store with enough Objects that reuse is
visible, and a statistics line showing a real saving.

A second scenario starts already mid-conflict, so the most interesting
behaviour in the project is one click away rather than something a visitor has
to construct by hand. Most people will never build a conflict themselves, and
if they do not see one they will not see what this was built for.

A reset returns any scenario to its starting state, so experimenting is
consequence-free.

**Blocked by:** 13 — a mid-conflict scenario is only worth loading if there is
a way to resolve it.

**Status:** ready-for-agent

- [ ] Arriving at the deployed link shows a Repository with existing history, no setup required
- [ ] The default scenario contains at least one branch and enough Objects that reuse and the statistics line are meaningful
- [ ] A second scenario loads a Repository already mid-merge with unresolved Conflicts
- [ ] A third scenario demonstrates fast-forward, where merging creates no Merge Commit
- [ ] Scenarios can be switched without reloading the page
- [ ] Reset returns the current scenario to its starting state
- [ ] Scenario content is realistic — recognisable source files, plausible messages, not `foo` and `bar`
- [ ] Loading a scenario is fast enough that the first paint is not visibly delayed
