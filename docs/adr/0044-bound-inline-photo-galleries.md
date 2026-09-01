---
---

# ADR 0044: Bound Inline Photo Galleries and Preserve Full History

[Documentation Home](../index.md) | [ADR Index](README.md)

## Status

Accepted

## Date

2026-09-01

## Context

Gravesites and physical markers accumulate field photos over time. Rendering every linked image directly in the detail panel makes the record increasingly crowded and pushes operational information far down the page. Users still need access to older images because they document condition, inscriptions, repairs, and changes over time.

The image captured date is the best available chronology. Upload date is a reliable fallback for images without captured-date metadata.

## Decision

Show at most four linked photos in an inline two-column preview. Order photos newest first by `captured_at`, falling back to `uploaded_at`, so the latest image occupies the top-left position.

When more than four photos exist, show `View all photos (N)`. This opens a responsive modal containing the complete newest-first history. The modal supports its close control, backdrop dismissal, and the Escape key. Existing authorization continues to govern upload and deletion; opening the full history is available to every user who can read the record.

The API continues returning all linked photo metadata. The four-photo limit is a presentation rule, not deletion, archival, or a database query limit. If collections later become large enough to affect response size, add paginated full-history retrieval without changing the four-photo inline contract.

## Consequences

Record pages remain a stable height as photo histories grow, while older evidence stays one action away. Newer evidence is consistently prominent even when legacy display-order values differ. Opening the complete history renders all currently returned photos, so very large collections may eventually require pagination and thumbnail generation.

## Rebuild And Validation

Run:

```bash
npm run lint
npm run build
npm run test:server
cd docs
bundle exec jekyll build
```

Verify that records with zero through four photos do not show the full-history action, records with five or more show exactly four inline images, the latest dated image is top-left, and every older image appears in the modal.

## Update Triggers

Add a superseding ADR if the inline limit changes, ordering no longer follows photo chronology, the application adopts pagination, or photo histories move to a separate record page.
