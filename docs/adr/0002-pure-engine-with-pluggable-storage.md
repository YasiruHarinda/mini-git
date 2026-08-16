# 2. The engine is pure; storage is pluggable

Date: 2026-08-16

## Status

Accepted

## Context

The project needs two things that pull in opposite directions. A publicly
deployed demo is essential, because a link gets clicked and an install command
does not — which argues for running entirely in the browser. But a real
filesystem is close to the essence of what version control is, and a
browser-only version invites the fair objection that the files are textareas
rather than files.

Running a hosted backend with a real per-user filesystem was considered and
rejected: sandboxing, cleanup and abuse handling are a large amount of
infrastructure spent on a problem this project does not exist to solve.

The two demands are only in conflict if the engine knows where it is running.

## Decision

The engine knows nothing about files, browsers or databases. It reaches
storage through a small interface — read an object by ID, write an object,
list and update refs. Two implementations exist: an in-memory store backed by
browser storage for the deployed demo, and a filesystem store for the command
line tool and the test suite.

## Consequences

Both demands are met without compromise. The demo is a one-click link with no
backend to host, and the same engine writes real files on disk when driven
from the command line.

Tests run in Node against the filesystem adapter at full speed, rather than
through a browser harness. This matters more than it sounds: the differential
tests against real git (see ADR 0001) need a real filesystem, and would be
awkward or impossible to run in a browser.

The seam is also the clearest illustration in the codebase of a boundary drawn
in the right place, which is worth having in a project meant to be read.

Cost is roughly two to three hours designing the interface, plus the standing
discipline of keeping it honest — any convenience that leaks a path, a `fs`
call or a browser API into engine code destroys the property this decision
exists to create. The interface should stay small enough that a third adapter
would be easy, because that is the test of whether it is really an interface.
