---
---

# ADR 0111: Focused Marker And Inspection Editing

- Status: Accepted
- Date: 2026-10-23
- Extends: ADR 0069 and ADR 0110

## Context

The marker editor mixed physical attributes, condition observations, face readings, and source review. Inspection drafts repeated these concepts alongside increasingly large photo controls, making it difficult to identify what an edit would save.

## Decision

Use three independent marker editing entry points: Edit marker information for physical attributes and general designs, Edit face records for persistent face definitions/readings and people/photo associations, and Edit sources & review for provenance and stewardship. Record dated condition, notes, readings and visit photos through Inspections. Remove condition and last-inspected edits from the general marker information form. Preserve existing values in the save payload and retain the existing API, permission checks, concurrency behavior and storage model.

Inspection creation and correction use Visit & condition, Faces & photos, and Review & save. Next/Back and direct step buttons preserve one shared draft. Only the final stage offers Save inspection; the review summarizes source, date, condition, face readings/designs and selected photo filenames. Optional face designs expand separately. Missing required information is explained in the review. Existing inspections with year-only dates remain editable without inventing an exact date.

Keep face editors mounted while navigating stages to preserve local photo previews and picker state. Saving still writes the inspection once, then its selected photos. After partial success, lock observation fields, show saved/pending photo results, and retry only pending entries. Cancel and external navigation retain draft-discard guards. No data migration is required.

## Consequences

Physical marker edits are shorter and observations have a clear dated workflow. Persistent face records and historical source review remain available through explicit actions. Inspection photo linking, historical snapshots, unknown-side readings and the all-monument library keep their existing semantics. One inspection can still contain multiple face editors in its Faces & photos stage.

## Validation And Rebuild

Run `npm run lint`, `npm run build`, and `npm run test:inspections:browser`. The focused browser configuration uses mocked API state on port 5199 and does not write DEV records. Include marker face, inscription status, saved-draft and overview regressions when changing the editing entry points. Check the flow at phone width and verify failed inspection saves and partially failed photo uploads preserve drafts and skip completed work.
