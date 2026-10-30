---
---

# ADR 0183: Scope local search before matching

- Date: 2026-10-30
- Status: Accepted

## Decision

Search the existing cemetery-scoped map collections for local graves, lots and
monuments. An unresolved scope supplies empty collections. The all-cemetery admin
scope continues to search the full dataset. Skip local grave matching and sorting
when the current remote result is available, including a successful empty result.
Local grave matching remains available while waiting for a new query and after
remote errors. Cemetery filtering on combined results remains as a defensive check.
The API remains responsible for authorization.

## Validation and recovery

Run `npx tsc -b`, `npm run lint`, and the scoped-local-search, search-pagination,
monument-search and gravesite-labels Playwright specs. Mocked API browser tests
cover switching cemetery scope during fallback and an empty successful remote
result replacing local matches. Revert the App selectors to restore the earlier
calculation strategy; no migration or persisted state change is required.
