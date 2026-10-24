---
---

# ADR 0114: Marker Overview Inspection Summary And Quick Actions

- Status: Accepted
- Date: 2026-10-23
- Extends: ADR 0111, ADR 0112 and ADR 0113

## Context

Marker Overview showed photos, associated people and linked gravesites, but users had to enter Details and locate an editor before recording common field work. The marker-level condition could also differ from dated inspection observations.

## Decision

Add a latest-inspection summary to marker Overview: recorded date or year-only precision, condition, inspection type, source, and a short condition-note preview. Select the same visit as inspection history using a shared ordering helper: visit date/year, then update timestamp and ID. Pad year-only sorting keys to handle years below 1000 correctly without inventing a date. Preserve Unknown condition from the latest visit rather than borrowing a known marker condition or an earlier observation. Without inspection history, explicitly label the legacy marker condition/date as a marker-summary fallback.

Place the summary and quick actions above the photo so common field tasks are visible at phone width. Add permission-aware Record inspection, Add photos, Record maintenance, and Edit marker information actions. Editing options must be available for lookup-dependent actions; keep photos available independently and offer retry when lookup loading fails. Readers retain the summary and inspection-history link without editing actions; inspection editing remains separately permission-controlled.

The coordinator sends a one-shot initial action when opening Details. The focused editor consumes it after launch so saves, re-renders, subsequent edits and later tab visits do not repeat the action. Record inspection uses the existing draft and copies the latest selected reading; stage focus is applied after the draft fields mount. Record maintenance expands the marker-bound form and focuses its first field. Edit marker information opens the existing small editor. Each action performs no write until explicit Save/Upload.

Add photos opens the shared gallery in upload mode, focuses its file control after associations load, and preserves Overview as the return destination. Default to the marker library without silently assigning the latest inspection; users can explicitly choose an inspection or maintenance record in the gallery. Existing pending-file, retry, permissions and focus-restoration behavior remains authoritative.

## Consequences

Common field tasks are available directly from Overview while forms stay in their existing workflows. Photo choice and linked people/owners remain unchanged. The inspection summary communicates its own evidence date/source; the primary photo continues to follow the existing marker-library ordering. No schema or API changes are required.

## Validation And Rebuild

Run `npm run lint`, `npm run build`, and `npm run test:inspections:browser`. The suite includes `marker-overview-actions.spec.ts` covering latest-visit ordering, year-only/unknown and no-history states, all four actions, independent saves, updated Overview summaries, one-shot launch behavior, lookup retry, reader/power-user/cemetery-admin access, marker-bound maintenance, photo target context, keyboard focus and phone layout. Inspect the phone screenshots. Existing inspection, draft, gallery and overview tests remain in the same isolated suite on port 5199.
