# 02 — Trees and Commits complete the object model

**What to build:** Directory hierarchies and point-in-time snapshots can now be
stored, and real git reads both. After this ticket all three Object kinds
exist, so everything above is composition rather than encoding.

Tree entry sort order is the known trap in this ticket and the reason it is
scoped separately. Entries sort as though directory names carry a trailing
slash, so `src.js` precedes `src/` — against what a naive comparison of the
raw names gives. Object IDs will disagree with git until this is exactly
right, and the differential tests will say so immediately.

**Blocked by:** 01 — needs the codec, the store and the differential test
harness.

**Status:** ready-for-agent

- [ ] Tree Object IDs match real git's for the same entries
- [ ] Entries sort with directory names treated as carrying a trailing slash, covered by a test that fails under naive name sorting
- [ ] Nested Trees round-trip: a Tree containing a Tree containing a Blob reads back identically
- [ ] An empty Tree round-trips
- [ ] Commit Object IDs match real git's for the same Tree, Parents, author, committer, message and timestamps
- [ ] A Commit with no Parent and a Commit with two Parents both encode and round-trip
- [ ] `git cat-file -p` prints Trees and Commits written through the filesystem adapter
- [ ] Objects are read back by ID and parsed, not only written — the codec works in both directions for all three kinds
