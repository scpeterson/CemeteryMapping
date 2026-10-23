---
---

# ADR 0117: View And Manage Photos Within Inspection Faces

- Status: Accepted
- Date: 2026-10-23
- Extends: ADR 0112, ADR 0115 and ADR 0116

## Context

Face cards include linked photo counts, but the face editor only showed photos selected for the current draft. Users could not inspect the existing evidence beside new selections.

## Decision

Use the existing association fetch to render each face’s linked photos alongside draft selections. Apply the same effective draft assignments as the cards, showing each asset once. Label saved links and draft selections separately. Share MediaPhoto thumbnail, authorized original loading, retry and full-size viewer behavior for saved/library assets. Local-file previews open the same style of viewer without uploading files. Exempt photo-viewer close controls from the global draft-navigation guard; closing a viewer must not discard the parent inspection.

Keep saved-photo management in the shared gallery. Manage photo link opens that inspection and stable face ID, avoiding ambiguous face labels or renamed draft labels. Existing gallery permissions and Edit photo link/Unlink from this record controls remain authoritative. Gallery changes save independently; explain this alongside linked-photo controls. On closing the gallery, refresh linked photos and card counts while keeping readings, file objects, notes and selections intact. Removing a draft selection continues to write nothing; viewing does not save or upload anything.

Load the face-photo editor lazily when an inspection draft opens to keep the map application within its existing bundle budget.

## Validation

Run `npm run lint`, `npm run build` and `npm run test:inspections:browser`. Browser tests cover per-visit/face visibility, local and saved viewing, close/Escape without discard prompts, exact-face gallery launch, saved link reassignment/unlink, preservation of other visits and original media, draft retention, and phone layout. Existing save/retry and count tests remain in the suite. No schema or API changes are needed.
