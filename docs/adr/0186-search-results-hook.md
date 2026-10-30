---
---

# ADR 0186: Centralize search result orchestration

- Date: 2026-10-30
- Status: Accepted

## Decision

Move remote-search state, scoped local fallback, the memoized monument grave
index, result combination and map highlight derivation into
`useCemeterySearchResults`. App passes cemetery-scoped map data and consumes
results plus the existing loading/error/pagination/retry controls.

Keep request debouncing, aborts and pagination in `useCemeterySearch`; keep local
matching algorithms in `lib/search`. Named pure selectors in `lib/searchResults`
express mixed-result ordering, cemetery filtering and grave-only highlight keys.
This is a boundary/readability change with the preceding search optimizations
retained. It introduces no extra request, cache or persisted state.

## Validation and recovery

Run `npm run build`, `npm run lint`, `npm run test:server`, and the search, map,
request-cancellation and overview Playwright regressions. Pure selector tests
cover mixed record order, cemetery scoping including unresolved scope, empty
remote grave results, blank queries and cemetery-qualified highlight keys.
Revert the extraction to restore App's inline selectors without changing data
or the API. No migration is required.
