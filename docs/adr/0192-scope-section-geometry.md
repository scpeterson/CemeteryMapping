---
---

# ADR 0192: Scope section geometry and labels by cemetery identity

- Date: 2026-10-30
- Status: Accepted

## Decision

Include cemeteryId in section summaries from both map response paths and preserve
it in section GeoJSON properties. Filter sections by that identity alongside the
other scoped collections. An unresolved scope has no sections; the admin all-cemetery
scope retains every active section. Repeated section names across cemeteries do
not affect filtering. Missing cemetery identity is never inferred from display
names. Per-collection memoization remains intact. This adds a response field and
requires deploying the API and frontend together; no schema migration is needed.

## Validation and recovery

Run TypeScript, lint, map-response server tests, section-cemetery-scope and stable
collection browser regressions, and APP_ENV=test node --test
scripts/section-cemetery-scope.integration.mjs. Fixtures cover duplicate names,
deleted/unmapped sections and scope switching. Revert the projection, mapper,
section type and scope filter together to restore the earlier behavior.
