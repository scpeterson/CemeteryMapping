---
---

# ADR 0113: Marker Details Sections

- Status: Accepted
- Date: 2026-10-23
- Extends: ADR 0111 and ADR 0112

## Context

Focused editors and a unified photo gallery reduced individual form complexity, but marker Details still mixed observations, physical attributes, source review, relationships and maintenance in one undifferentiated record.

## Decision

Organize every marker record into five sections, in order: Inspections, Photos, Maintenance, Marker information, and Sources & review. Apply the same structure to standalone marker Details and markers opened through a gravesite. Provide wrapping jump links with unique per-marker heading targets. Links scroll and focus headings without unmounting sections or discarding drafts.

Keep dated observations and earlier undated condition information in Inspections. Photos opens the existing shared gallery. Maintenance contains marker-specific work records and a collapsed creation form; marker creation stays bound to that marker even from a gravesite panel. Existing gravesite maintenance remains in its own tab.

Marker information owns physical metadata, persistent face records, features, and marker/gravesite relationships. Standalone relationship managers are passed into that section by the coordinator. Sources & review owns NHG inclusion/evidence, verification, confidence, review status, conflict badges and review notes, including explicit empty/unknown summaries.

Place each edit action in its owning section. The existing focused form receives initial focus when opened; Save or Cancel returns focus to that section. Editing that replaces a record continues to use draft-discard guards. Inspection and maintenance drafts remain mounted when using section links or opening the shared photo gallery. Permissions, save payloads, storage and API behavior remain unchanged.

## Consequences

Users can identify the correct workflow without scanning unrelated fields. Section links retain a visible, single-page record instead of introducing more tab levels. Maintenance is now directly available for each marker in the gravesite's marker view; the separate gravesite maintenance history retains its own target and permissions. No database migration is required.

## Validation And Rebuild

Run `npm run lint`, `npm run build`, and `npm run test:inspections:browser`. The isolated browser suite includes `marker-sections.spec.ts` for section order, standalone/gravesite parity, action placement, reader permissions, draft/photo preservation during jumps, marker-bound maintenance creation, keyboard focus and phone layout, alongside existing inspection/photo regressions. Inspect phone screenshots from the section tests.
