# 1. Objects are encoded byte-identically to real git

Date: 2026-08-16

## Status

Accepted

## Context

A version control engine can hash its objects any way it likes. The easy
choice is SHA-256 over a JSON representation: readable when debugging, trivial
to implement, no binary encoding to get wrong.

The problem is verification. With a private format, correctness means "my
tests agree with my code" — the tests and the implementation share every
assumption, so a misunderstanding of how version control works passes both.
There is no outside opinion.

Real git is installed on the development machine (2.50.1). If objects are
encoded exactly as git encodes them — `<type> <size>\0<content>`, SHA-1, with
tree entries as `<mode> <name>\0<20 raw bytes>` sorted git's way — then object
IDs come out identical to git's, and `git hash-object` becomes an oracle that
can be asserted against on every test run.

## Decision

Objects use git's exact serialisation and SHA-1. The test suite compares
computed IDs against real git's output for the same content, across all three
object types. The filesystem adapter additionally writes zlib-compressed loose
objects in git's directory layout, so a repository created by this tool can be
read by real git.

## Consequences

Correctness is checked against the reference implementation rather than
against our own understanding. When the question "how do you know this is
right?" comes, the answer is a differential test rather than an assurance.

Because the encoding is already byte-correct, exporting a real `.git`
directory costs only compression and file layout, and `git log` on a
repository this tool created becomes a demonstration rather than a project.

Costs. Binary encoding is fiddly and unreadable during debugging, and tree
entry sort order has a genuine trap: entries are sorted as though directory
names carry a trailing slash, so `src.js` sorts before `src/` despite what a
naive comparison gives. Expect to lose time to exactly that.

SHA-1 is cryptographically broken and is used here, as in git, for content
addressing rather than security. Git has been migrating toward SHA-256; this
project does not follow, because compatibility with the installed git is the
entire point of the decision. Choosing SHA-256 would mean giving up the
oracle, which is the thing being bought.
