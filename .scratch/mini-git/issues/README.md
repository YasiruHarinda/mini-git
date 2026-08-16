# Mini Git — tickets

Sixteen tracer-bullet slices derived from [`docs/spec.md`](../../../docs/spec.md).
Each cuts a narrow but complete path through every layer it touches, and is
demoable or verifiable on its own.

Work the **frontier**: any ticket whose blockers are all complete. Clear
context between tickets.

| # | Ticket | Blocked by |
|---|---|---|
| 01 | A Blob written by the tool is readable by real git | — |
| 02 | Trees and Commits complete the object model | 01 |
| 03 | `init`, `add`, `commit` and `log` through the Repository API | 02 |
| 04 | Branch and checkout, with the safety refusal | 03 |
| 05 | Diff between two Commits | 03 |
| 06 | Merge Base discovery and fast-forward | 04 |
| 07 | Three-way merge and the full conflict matrix | 05, 06 |
| 08 | Graph layout as an engine query | 07 |
| 09 | Web shell: three columns, editor, staging — deployed | 03 |
| 10 | Commit graph view | 08, 09 |
| 11 | Object inspector with new-versus-reused and dedup statistics | 09 |
| 12 | Diff view in the interface | 05, 09 |
| 13 | Conflict resolution interface | 07, 09 |
| 14 | In-browser terminal | 07, 09 |
| 15 | Preloaded demo scenarios and reset | 13 |
| 16 | Real `.git` export, and the README | 07 |

## Shape of the work

```
  01 → 02 → 03 ─┬─ 04 → 06 ─┐
                │           ├─ 07 ─┬─ 08 ─┐
                ├─ 05 ──────┘      ├─ 13 ─┼─ 15
                │                  ├─ 14  │
                └─ 09 ─┬─ 11       └─ 16  └─ 10
                       └─ 12
```

Three fronts open after 03 and can proceed in parallel: the merge chain
(04 → 06 → 07), diff (05), and the interface (09).

## Ordering notes

**09 is not blocked by merge.** The deployed link exists as soon as the engine
can commit, and every later interface ticket redeploys on top of it. This is
the checkpoint discipline expressed as edges: the project is presentable from
roughly its midpoint rather than only at the end.

**01 through 03 are deliberately fine-grained.** That is where the differential
oracle against real git gets established and where the tree entry sort trap
lives. Small, certain ground there makes everything above it cheap.

**08 waits for 07** so that lane assignment is built once, knowing Merge
Commits exist, rather than built for linear history and retrofitted.
