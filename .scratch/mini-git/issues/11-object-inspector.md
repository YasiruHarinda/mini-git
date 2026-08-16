# 11 — Object inspector with new-versus-reused and dedup statistics

**What to build:** The X-ray itself. Someone clicks a Commit and walks down
through it — Commit to Tree, Tree to sub-Tree, sub-Tree to Blob — seeing every
Object ID and, at the bottom, actual file content. Hashes stop being noise and
become addresses.

The single most valuable thing on this screen is the distinction between
Objects created by the latest action and Objects reused unchanged. Change one
file three directories deep, and four new Objects appear beside dozens that
did not move. That is Structural Sharing, and nobody needs to be told about it
once they have seen it.

Only the engine knows which Objects were reused, so this ticket extends the
Repository API to report it — the interface must not try to infer it by
comparing snapshots.

A statistics line completes the picture: unique Blobs against total file
versions committed, and the proportion saved.

**Blocked by:** 09 — needs an interface and a Repository to inspect.

**Status:** ready-for-agent

- [ ] Selecting a Commit shows its Tree, Parents, message and Object ID
- [ ] Trees can be expanded into their entries, and sub-Trees expanded in turn
- [ ] Selecting a Blob shows its content
- [ ] Every Object displayed carries its Object ID
- [ ] The Repository API reports, per Object, whether it was created by the most recent operation or reused
- [ ] Newly created and reused Objects are visually distinguished in the inspector
- [ ] Changing one deep file and committing shows a small number of new Objects against many reused ones
- [ ] A statistics line reports unique Blobs, total file versions committed, and the proportion saved
- [ ] Two identical files at different paths are visibly the same Blob
