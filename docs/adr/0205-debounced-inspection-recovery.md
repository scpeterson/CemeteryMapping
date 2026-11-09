# ADR 0205: Debounce inspection recovery writes with lifecycle flushing

- Status: Accepted
- Date: 2026-11-09
- Related: ADR 0074, ADR 0204

## Decision

Delay browser inspection-recovery serialization and storage writes until 350 ms
have elapsed since the latest committed draft, step, or active-face change.
Keep the latest pending snapshot in memory. Flush synchronously when the page
hides, before unload, on pagehide, and when the account/marker-keyed editor
unmounts. Keep failed snapshots pending for retry and retain the existing storage
failure message. Successful saves and explicit discards cancel queued writes
before removing recovery, preventing delayed writes from recreating it.

Retain the existing versioned, account/marker-scoped recovery format, explicit
resume, optimistic concurrency values, partial-save state, and photo metadata.
Photo files remain reselection placeholders rather than serialized contents.

This reduces repeated synchronous browser storage work during inscription entry.
It does not debounce server saves or the existing unsaved-change guard. Abrupt
process termination before the timer or a lifecycle event can still lose the
latest pending edits; this is browser recovery rather than server autosave.

## Bundle budget

The production build measured 700.19 KiB of charged core JavaScript after this
change, approximately 0.2 KiB above the previous 700 KiB cap. Raise the core cap
by a bounded 1 KiB to 701 KiB to accommodate the debounce and lifecycle handling.
This is application growth and is not credited to MapLibre. Individual entry,
map, admin, vendor, and standalone workspace caps remain unchanged. This amends
the core cap in ADR 0074 and the core calculation referenced by ADR 0204.

## Validation

Run `npm run lint`, `node --test scripts/check-bundle-size.test.mjs`,
`npm run build`, and `npm run test:inspections:browser`. The focused
`tests/inspection-draft-saves.spec.ts` checks coalescing, lifecycle flushing,
cancellation, account/marker isolation, file reselection, partial-save recovery,
and storage-failure retry using a controlled browser clock. The existing
inspection suite also covers actual reload, saves, discarded drafts, photo
retries, navigation, keyboard behavior, and phone workflows.
