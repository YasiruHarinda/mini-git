# 04 — Branch and checkout, with the safety refusal

**What to build:** Someone can create a Branch, move between Branches, and see
the Working Tree change to match. Two Branches can diverge and both stay
reachable — which is the situation merging exists to resolve, so this ticket
sets up the next three.

Two behaviours carry the teaching value. Creating a Branch creates no Objects
at all, which is the concrete form of "a Branch is a pointer, not a container".
And checkout refuses rather than silently discarding work: when uncommitted
changes would be overwritten by the switch, it stops and names the paths
standing in the way. Changes to files that are identical in both Commits are
carried across untouched.

**Blocked by:** 03 — needs Commits, Refs and a Working Tree.

**Status:** done

- [x] `branch` creates a new Ref at the current Commit and creates zero new Objects, asserted as a count
- [x] Branches can be listed, and the listing shows which one HEAD points at
- [x] `checkout` moves HEAD and rewrites the Working Tree to match the target Commit
- [x] Files present in the old Commit but absent from the new one are removed from the Working Tree
- [x] Checkout refuses when uncommitted changes would be overwritten, and the message names every offending path
- [x] Uncommitted changes to files that do not differ between the two Commits survive the switch untouched
- [x] Committing on two Branches leaves both reachable, with history diverging from a shared Commit
- [x] Deleting a Branch removes the Ref and destroys no Objects
