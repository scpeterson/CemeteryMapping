---
---

# ADR 0213: Inspection face status and current reading attribution

- Status: Proposed
- Date: 2026-11-15
- Related: [ADR 0205](0205-debounced-inspection-recovery.md), [ADR 0209](0209-maplibre-growth-reporting.md)

## Decision

Store optional inscription status, legibility, and historical source readings in
each inspection face's existing JSON snapshot. Reuse the marker inscription
controls for mutual exclusivity and exact-text protection. Normalize only exact
standalone `[blank]` and `[illegible]` placeholders in submitted snapshots, not
existing visits in bulk. Keep source history through draft copies, recovery,
review, and saves. Preserve unspecified JSON evidence for older clients.

Derive Current marker reading from the latest active inspection using the same
ordering as Overview and inspection history, and show its date/year, type, and
source. Do not fill empty/latest unreadable readings from an older visit or the
stored marker summary. Label the no-inspection fallback explicitly. Preserve
stored marker face records and source history separately, without rewriting
historical observations or assigning uncertain history to a guessed face.

No database migration is needed. Inspection JSON already supports the fields,
and current-reading attribution is a UI projection rather than a rewrite of
`headstones.inscription` or its archived evidence. Existing print/report consumers
of stored marker summary fields retain their existing behavior.

## Bundle budget

With reproducible CI build metadata, main charges 700.99 KiB gzip and this feature
charges approximately 701.25 KiB, an increase of about 0.26 KiB after sharing the
reading display and removing duplicate fallback rendering. Propose a bounded
1 KiB increase from 701 to 702 KiB. This is application code growth for the
requested controls and attribution, not an exemption for third-party packages.
All individual chunk and standalone workspace limits, and the rule that every
shared/lazy application chunk counts toward core, remain unchanged. This amends
the core allowance in ADR 0205; MapLibre reporting/credit rules are unchanged.

## Validation

Server regressions cover status consistency, exact mixed text, source history,
and submitted legacy placeholder normalization without source mutation. Browser
regressions cover desktop/phone mutual exclusivity, save/reload, copied statuses
and history, draft recovery, inspection selection independent of the current
summary, year-only provenance, and no-inspection fallback. Rollback-only database
fixtures verify status/history persistence, older-client updates, unchanged
marker/older inspection evidence, concurrency and photo-link protection.
