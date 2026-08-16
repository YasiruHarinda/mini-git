# 3. The interface is an X-ray, not a git client

Date: 2026-08-16

## Status

Accepted

## Context

"Add a UI" hides three different products, and they optimise for opposite
things.

A git client — stage, commit, branch and merge through a conventional
interface — is the obvious reading. It is also a trap. It competes with VS
Code's source control panel and with GitKraken, tools carrying hundreds of
engineer-years, and it cannot win. Worse, it *conceals the engine*: a
conventional client deliberately hides object IDs, trees and structural
sharing, which are the only parts of this project worth showing. A viewer
would see a weaker version of a tool they already have.

A guided learning sandbox with levels and objectives was also considered.
Genuinely useful and shareable, but a large share of the budget becomes
writing lesson content, and lesson content is then what gets judged.

The third option treats the internals as the product: every panel is a window
onto the object graph, and every action's consequence in the object store is
what appears on screen.

## Decision

The interface exists to make the invisible visible. Commit graph, a clickable
object inspector walking commit to tree to blob, live object IDs, objects
marked as newly created or structurally shared, and the Index shown as the
flat list it actually is, folding into a hierarchy at commit time. Operations
are still driven interactively, but the interface is organised around
revealing state rather than around performing tasks.

## Consequences

The interface becomes evidence. The claim "this implements a Merkle DAG with
structural sharing" does not need to be made, because changing one file and
watching four new objects appear alongside dozens of reused ones demonstrates
it. This is the reason the nested-tree object model was worth its hours: in a
conventional client, that work would be invisible.

It also means the interface cannot be evaluated as a usable git client, and
should not be presented as one. Anyone asking "would you use this to manage a
real project?" has been given the wrong frame, and the README should set the
right one in its first sentence.

Design pressure runs opposite to normal application design: where a client
would hide a hash, this shows it. Any decision that makes the tool more
convenient by concealing mechanism is the wrong decision here.
