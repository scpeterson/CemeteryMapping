---
---

# ADR 0115: Focus Inspection Editing On One Face

- Status: Accepted
- Date: 2026-10-23
- Extends: ADR 0111 and ADR 0112

## Context

Showing every face reading and photo control together makes multi-face inspections long and difficult to navigate.

## Decision

In Faces & photos, show selectable face cards above one visible editor. Each card shows its label, whether a non-whitespace reading exists, and the number of photos selected for this draft. Counts include queued uploads and selected existing library photos; they do not imply a count of previously saved gallery links. Copying readings into a new inspection continues to copy no photos.

Select faces by stable ID so renaming a face retains its selection. Start with the first face, select newly added faces automatically, and retain the selected face between workflow stages. Keep inactive face editors mounted but hidden so readings, design notes, photo selections, previews and expanded controls survive switching. Native buttons expose selection via aria-pressed and support keyboard activation. Cards wrap at phone widths.

Review & save continues to show the entire inspection. Existing validation, save/retry behavior, permissions, face limits and gallery associations remain unchanged. No API or database changes are required.

## Validation And Rebuild

Run npm run lint, npm run build and npm run test:inspections:browser. Browser coverage checks face switching, keyboard use, whitespace-only readings, counts for uploads and library selections, removing photos, adding/renaming faces, retention across stages, original save associations, and phone layout. Inspect the phone screenshot.
