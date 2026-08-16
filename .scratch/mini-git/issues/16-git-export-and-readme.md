# 16 — Real `.git` export, and the README

**What to build:** The demonstration that settles the question. The tool
exports a repository as a real git directory, and actual git reads it — `git
log` shows the history, `git cat-file` prints the Objects, `git status` works
in the checkout. Not a repository *like* git's. Git's.

Most of the machinery already exists: the filesystem adapter has been writing
zlib-compressed loose objects since ticket 01, and Object IDs have matched real
git's throughout. What remains is assembling the directory around them — refs,
HEAD, and enough of the surrounding structure that git recognises the result.

The README ships in this ticket because framing is part of the deliverable.
Per ADR 0003 this is an X-ray, not a git client, and its first sentence has to
say so — otherwise the project gets evaluated as a worse GitKraken, which is
the one reading that makes it look bad.

**Blocked by:** 07 — a history worth exporting, including a Merge Commit.

**Status:** ready-for-agent

- [ ] A repository can be exported as a directory that real git recognises
- [ ] `git log` on the export shows the same history, including Merge Commits with both Parents
- [ ] `git cat-file -p` prints Blobs, Trees and Commits from the export
- [ ] An automated test performs the export and asserts on real git's output, skipping cleanly where git is absent
- [ ] Export works from the command line against a repository built by the command line tool
- [ ] The README's first sentence establishes this as a tool for seeing git's internals, not for managing projects
- [ ] The README states which parts are deliberately out of scope, so absences read as decisions
- [ ] The README shows the differential testing approach, since it is the project's strongest correctness claim
