---
---

# ADR 0181: Index graves for local monument search

- Date: 2026-10-30
- Status: Accepted

## Decision

Build a cemetery/grave-key lookup when the grave summary array changes and reuse
it across query edits. Local monument search checks the monument identifier before
looking up its grave status. Standalone and unmatched monuments retain unknown
status, and ordering and reason text remain unchanged. This removes the nested
monument-by-grave scan without caching across changed summary arrays.

## Validation and recovery

Run `npx tsc -b`, `npm run lint`, and the indexed-monument-search Playwright
regression (a unit test that needs no browser). The regression covers identical
grave IDs in different cemeteries, missing associations, normalization and order.
Revert this change to restore linear grave lookup per monument. No migration is
required.
