---
---

# ADR 0124: Show Required-Information Status On Inspection Steps

- Status: Accepted
- Date: 2026-10-23
- Extends: ADR 0122 and ADR 0123

## Decision

Show live required-information badges on the three inspection step buttons. Visit & condition uses the missing visit-field count, Faces & photos uses missing face labels, and Review & save uses the combined count. Show Required info complete on satisfied editing steps. With no missing items, the final step shows Ready to review before opening it and Ready to save while open. These indicate required-information readiness rather than whether the user has reviewed a step.

Derive badges from existing validation state so they update immediately when fields are cleared or corrected. Preserve optional readings/photos/notes, valid year-only dates on existing inspections, and independent current-step highlighting. Use visible text and symbols in addition to color. Keep button accessible names stable and associate descriptive status text using per-instance aria-describedby IDs. Navigation, draft persistence and Save/retry behavior remain unchanged.

Load MonumentInspections lazily from marker Details to keep the growing inspection workflow within the existing map-application bundle budget. Preserve the one-shot Overview launch and mounted draft lifecycle after loading.

## Validation

Run `npm run lint`, `npm run build`, and `npm run test:inspections:browser`. Browser coverage checks initial and pre-review missing counts, accessible status descriptions, independent current-step state, live visit/face correction and regression, final readiness, year-only dates, preserved drafts and final save, and phone layout. No API or database changes are needed.
