---
---

# ADR 0182: Serialize search geometry after pagination

- Date: 2026-10-30
- Status: Accepted

## Decision

Carry grave UUIDs through search matching and pagination rather than GeoJSON.
After selecting the bounded page (including its continuation lookahead), join
those UUIDs back to gravesites and materialize GeoJSON once per page grave.
Reason rows then reuse that geometry. Matching, ownership visibility, status,
ordering, offset semantics and returned summaries remain unchanged. This reduces
geometry serialization and the width of materialized matching rows. It does not
avoid matching all eligible graves and does not change indexes or schema.

## Validation and recovery

Run `npm run test:server`, `npm run lint`, and
`APP_ENV=test node --test scripts/search-ownership-regression.integration.mjs scripts/record-normalization.integration.mjs`.
Rollback-only fixtures cover geometry, reasons, owner permissions, statuses,
empty results and page boundaries with lookahead. Old/new results also matched
in one read-only repeatable-read DEV snapshot for Garcia, Smith and a sold-status
page with an offset. No latency claim is made from these correctness checks.
Revert this query change and restart the API to restore the earlier strategy.
