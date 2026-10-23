---
---

# ADR 0119: Edit A Face Directly From Inspection Review

- Status: Accepted
- Date: 2026-10-23
- Extends: ADR 0115 and ADR 0118

## Decision

Place Edit face beside every face heading in Review & save. Each action selects the face by stable ID and returns to Faces & photos without replacing draft state or writing data. Include the face number and label in the accessible action name, including an unlabeled fallback. Existing saving/record-saved disabling applies.

After the stage DOM commit, consume a pending focus request to scroll and focus the selected face’s label field. Ordinary stage changes keep their existing heading focus. Keep all face editors mounted so visit values, readings, design details, file objects, notes, library selections and expanded controls survive navigation. Renaming or blanking a face label does not change its identity or prevent correction.

## Validation

Run `npm run lint`, `npm run build`, and `npm run test:inspections:browser`. Browser coverage checks keyboard activation, focused destination and selected face, repeated correction round trips, renamed and unlabeled faces, preservation of other faces and visit/photo drafts, no writes before explicit save, correct final save associations, and phone layout. No API or database changes are required.
