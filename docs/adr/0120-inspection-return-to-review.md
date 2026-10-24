---
---

# ADR 0120: Return To Inspection Review After A Face Correction

- Status: Accepted
- Date: 2026-10-23
- Extends: ADR 0119

## Decision

When Edit face opens a correction from Review & save, replace Next: Review & save with Return to review. Return moves to review and focuses the current face’s Edit face action after the DOM commit, using the stable face ID so label changes do not affect the destination. Face-card switches retain this correction context and return to the currently selected face. Leaving Faces & photos clears the context; ordinary inspection entry retains Next and stage-heading focus.

Navigation changes only transient UI state. Preserve all inspection values, file objects, notes, existing-photo selections and validation. Return performs no upload, save or discard operation. Normal saving and saved-record retry behavior remain authoritative.

## Validation

Run `npm run lint`, `npm run build`, and `npm run test:inspections:browser`. Browser coverage checks contextual action visibility, keyboard activation and focus in both directions, renamed/unlabeled faces, repeated corrections, normal-navigation reset, draft and photo retention, correct final save associations, and phone layout. No API or database changes are needed.
