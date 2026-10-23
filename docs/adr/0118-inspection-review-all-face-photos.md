---
---

# ADR 0118: Review All Inspection Face Photos

- Status: Accepted
- Date: 2026-10-23
- Extends: ADR 0115, ADR 0116 and ADR 0117

## Decision

Review & save shows linked and draft-selected photos for every face, with compact previews, filenames, notes, captured dates, linked/selected labels and totals. Reuse shared full-size viewers without editing controls. Closing viewers retains the inspection draft. Corrections remain in Faces & photos.

Share inspectionFacePhotos between card counts, face editing and review. Count each saved/library asset once, include local files, exclude inactive or non-photo saved assets, and apply draft face assignments before grouping. Preserve new-inspection isolation and original saved links until explicit save/gallery actions. The existing queued-photo status continues to describe save work rather than all existing evidence.

Reuse the editor’s association fetch, loading/error state and retry. Do not present unavailable linked evidence as an empty set; permit retry directly from review while retaining selected file objects and preview state. Keep the review component in the lazy face-photo module to preserve application bundle budgets.

## Validation

Run `npm run lint`, `npm run build` and `npm run test:inspections:browser`. Browser tests cover per-face review totals, saved/draft deduplication and reassignment, original visit isolation, file metadata, full-size viewing and close/Escape, correction round trips, loading/error/retry, retained previews and phone layout. No API or database changes are required.
