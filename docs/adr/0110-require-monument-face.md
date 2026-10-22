---
---

# ADR 0110: Require At Least One Monument Face

- Status: Accepted
- Date: 2026-10-22
- Extends: ADR 0069; inspection history and ADR 0109

## Context

Monuments with no current transcription can have an empty face list, while others use labeled faces. Older inspection snapshots also store only a general inscription. The administrator requests the same face structure for all monuments, populated from their existing information.

## Decision

Require at least one face per monument and inspection. Migration 491 backfills empty lists, and migration 492 adopts the administrator’s convention that new default monument faces and all existing single-face monuments use Front. Single-face inspection snapshots for those monuments use Front as well. Multi-face labels and historical unknown-side readings on multi-face monuments remain unchanged. Monument defaults preserve current text verbatim, status, legibility and unassigned historical readings. Archived readings that already name a different face remain in monument history. Physical metadata and relationships stay on the monument, and no photo/person association is guessed. Existing faces and their IDs/metadata are untouched.

An inspection’s default contains only that visit’s own inscription, with no copied current marker reading or media associations. Reuse the sole monument face ID when available; an unknown-side historical reading on a multi-face monument retains Unspecified face. Snapshots remain independent. Disable automatic capture during the monument backfill so independent visits are not refreshed.

Insert triggers supply persistent default faces for legacy clients/imports that omit them. Check constraints prevent empty lists afterward. Keep a sole Unspecified inspection snapshot synchronized when source or legacy code changes its general inscription. Reject explicit empty face arrays in API validation. Editors keep a default face even with an empty inscription and disable removal of the last face. Clearing a transcription still preserves its archived history.

## Consequences

Unknown, blank and illegible inscriptions all have a face, with their meaning kept distinct. New visits copy at least one selected reading without photos. Material, condition and shared features retain their existing model. Rollback removes constraints/triggers but keeps the backfilled faces and readings.

## Rebuild And Validation

Apply migrations 491–492 together with the matching API and frontend. Run the complete changelog and `APP_ENV=test npm run db:rollback:test` on an isolated TEST database, then `APP_ENV=test npm run test:db-rules`, `npm run test:server`, and the browser suite. `scripts/required-faces.integration.mjs` covers exact text/history preservation, independent snapshots, unchanged existing faces/media links, omitted-face inserts, statuses, legacy updates and rejected removal. Browser regressions cover saving/reloading unknown, blank and illegible faces and preventing last-face removal.

Historical migration fixtures copy current table definitions without triggers. Their temporary/schema-local copies must omit the newer minimum-face check to reconstruct the older schema; `scripts/lib/legacy-table-fixtures.mjs` handles temporary tables without touching public constraints.

## Update Triggers

Revisit if surfaces become relational rows or source evidence supplies a reviewed orientation. Do not represent unknown inscription content by removing the last face.
