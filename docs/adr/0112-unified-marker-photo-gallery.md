---
---

# ADR 0112: Unified Marker Photo Gallery

- Status: Accepted
- Date: 2026-10-23
- Extends: ADR 0111 and ADR 0069

## Context

Marker details, faces, individual inspections and maintenance records displayed overlapping galleries and different existing-photo/upload controls. The same image could appear repeatedly, and face/timing selections differed between linking and uploading.

## Decision

Provide one marker photo workspace, opened from marker, inspection, maintenance or face actions. `DetailPanel` owns its lifecycle and supplies current records and existing photo permissions/callbacks. Load the workspace lazily to preserve production startup bundle budgets. The selected record filters the gallery and supplies the destination for both uploads and links; switching to existing-photo selection temporarily shows the full marker library without changing that destination. All/unassigned library uploads create no observation association.

Render each image once, annotated with every inspection/maintenance link and its record-specific face/timing. Preserve persistent marker-face associations as additional labels and face-filter matches. Keep inspection face labels tied to their saved snapshots. Record, face and timing filters narrow the gallery. Existing authenticated photo loading, full-size viewing, primary ordering and deletion remain shared with other media views.

Use the same association fields for linking and uploading, including maintenance timing only for maintenance destinations. Inspection drafts retain their deferred per-face queue because the inspection must exist before photo associations can be saved; share thumbnail selection, preview behavior, field labels and file size limits. No schema/API changes or data migration are required.

Retain completed upload results independently of association refreshes. Refresh failures offer a read retry without treating an uploaded image as failed. Refresh requests are sequenced to discard stale results; the gallery remains mounted during refresh. Unlink deletes only the selected observation association. Existing API permissions remain authoritative, with read-only and inspection-specific editor permissions enforced in the UI as well.

Guard modal close and record/mode changes when uploads or changed links are pending. Lock context controls during upload, preserve failed files for retry, and use the existing modal for focus containment and restoration. Close enlarged images independently of the workspace and underlying inspection drafts.

## Consequences

Users have one photo location and one consistent association editor, while photos still document independent visits and maintenance work. Record views use gallery entry points rather than duplicate inline thumbnails. Full-size photo viewing remains a nested modal, and field inspection drafts can still stage photos before saving the visit.

## Validation And Rebuild

Run `npm run lint`, `npm run build`, and `npm run test:inspections:browser`. The focused browser suite uses mocked API state on port 5199, covering contextual entry points, filters, duplicate-free rendering, independent links/unlink, uploads, read-only access, pending-change protection, refresh/retry behavior, inspection draft recovery, primary ordering, protected images, natural image proportions and phone layout. No database rebuild is required.
