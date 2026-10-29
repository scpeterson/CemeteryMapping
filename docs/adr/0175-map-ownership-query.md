# ADR 0175: Resolve ownership once per cemetery map query

- Date: 2026-10-29
- Status: Accepted

## Decision

Materialize the current ownership view once in the map gravesite query and reuse
that relation in the shared derived-status expression. Other callers retain the
original relation by default. Status precedence, ownership semantics, response
fields and record ordering remain unchanged. This is per-query computation,
not a cache: each request reads current ownership from its database snapshot.
No migration or data correction is required.

## Evidence and tradeoffs

DEV query analysis found repeated evaluation of the ownership history view for
each gravesite. The gravesite query took about 6.3 seconds for 785 records while
other map queries took milliseconds. The revised query took 11–31 milliseconds.
Old and new results matched exactly in one read-only repeatable-read snapshot,
with and without cost fields. These are database timings, not browser load times.
Materialization uses temporary query memory and resolves all current ownership
rows once; revisit scoping if ownership volume grows substantially.

## Validation and recovery

Run `npm run test:server`, `npm run lint`, and
`APP_ENV=test node --test scripts/map-status-regression.integration.mjs scripts/record-normalization.integration.mjs`.
The rollback-only database regression covers review, interred, sold, reserved,
pre-need, direct and inherited ownership, duplicate owners, deleted records,
veteran flags and cemetery scoping in both map query modes.
Restart the local API to load the changed module. Reverting this query change
restores the previous execution strategy without changing stored records.
