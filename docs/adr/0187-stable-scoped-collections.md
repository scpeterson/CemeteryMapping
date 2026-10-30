---
---

# ADR 0187: Preserve unchanged scoped map collections

- Date: 2026-10-30
- Status: Accepted

## Decision

Memoize each scoped collection against its source array and cemetery scope.
Cemetery-name discovery depends only on boundaries and graves. Changing marker
summaries therefore retains grave, lot, section and boundary array identities,
avoiding unrelated map source submissions and search index rebuilds. The scoped
wrapper still changes when its contents change. Scope selection behavior is unchanged.

## Validation and recovery

Run the TypeScript build, lint, and stable-scoped-collections, scoped-local-search
and map-status-filter Playwright regressions. A React harness verifies reference
identity after a marker edit. Revert the hook to restore whole-data memoization;
no migration or data changes are required.
