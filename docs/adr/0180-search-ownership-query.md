---
---

# ADR 0180: Resolve current ownership once per search query

- Date: 2026-10-29
- Status: Accepted

## Decision

Materialize the current ownership view once per search query. Project target type,
lot/gravesite UUIDs, display name and effective date, then use that relation for
both the shared derived-status SQL and existing ownership match reasons. The
original role/cemetery gates remain on owner-name and ownership-date branches.
Matching, status precedence, grouping, result reasons, ordering, pagination and
normalization remain unchanged. This uses fresh data from the query snapshot,
not a cross-request cache. No migration or data correction is required.

Search previously re-evaluated the expensive history view per gravesite, including
repeated status calculations. DEV samples in one read-only repeatable-read
snapshot matched exactly before and after optimization: public-name search
18,424 to 150 ms; permitted owner search 19,607 to 171 ms; denied-owner search
19,295 to 153 ms; a sold-status page 7,873 to 11 ms. These are query timings,
not total browser interaction times or a guarantee for every dataset.

The shared batch temporarily holds owner name/date columns internally. They
remain excluded from returned reasons when ownership access is disabled or the
cemetery is outside the permitted set. Existing status derivation may use rights
regardless of owner-detail visibility, as before. Materialization consumes query
memory; revisit indexing/scoping if ownership volume grows substantially.

## Validation and recovery

Run `APP_ENV=test npm run test:server`, `npm run lint`, and
`APP_ENV=test node --test scripts/search-ownership-regression.integration.mjs scripts/record-normalization.integration.mjs`.
Rollback-only fixtures check owner-name/date privacy, cemetery scope, direct and
inherited sold status, duplicate owners, reasons and pagination. Compare complete
old/new results in the same read-only snapshot against DEV. Restart the running
DEV API with its existing environment to load the changed module; preserve auth
settings. Revert the query change to restore the previous execution strategy
without changing records. Hosted TEST deployment remains a separate action.

See [ADR 0175](0175-map-ownership-query.md) for the analogous map-query correction.

## Scope military matches before matching reasons

Military branch, rank, war service and decoration matches are computed once
per query for the graves in the selected cemetery and status filters. Grave
UUIDs attach those reasons to the existing result groups before pagination.
The military predicates, reason labels and ownership checks stay the same.

On local DEV, a read-only comparison with 20 samples per case measured the
broad query at 55.0 ms before and 45.6 ms after, and a no-match query at 37.6 ms
before and 24.2 ms after. These are warm-cache median repository timings.
Complete ordered responses matched across 13 cases, including scope,
pagination, ownership visibility and military terms.
