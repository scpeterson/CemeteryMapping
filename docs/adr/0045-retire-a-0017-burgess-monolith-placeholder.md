---
---

# ADR 0045: Retire the A-0017 Burgess Monolith Placeholder

[Documentation Home](../index.md) | [ADR Index](README.md)

## Status

Accepted

## Date

2026-09-01

## Context

The original marker-coordinate import created gravesite `A-0017` (`TLC-GPS-0017`) and a `Burgess Monolith` burial row at the coordinate for `TLC-HS-0017`. Later review established that the marker is a Burgess family monument with `monolith` scope. Its location is not a burial space, and neither the generated gravesite nor pseudo-burial represents a person who is or will be interred there.

Two field photos were linked to both the placeholder gravesite and the physical marker. They remain valid evidence for the monument and must not be deleted with the placeholder record.

## Decision

Migration `365-retire-a-0017-burgess-monolith-placeholder.sql`:

- soft-deletes gravesite `A-0017` and the generated `Burgess Monolith` pseudo-burial;
- soft-deletes the pseudo-burial and placeholder-gravesite links from `TLC-HS-0017`;
- clears the legacy `headstones.gravesite_uuid` compatibility anchor;
- removes only the redundant gravesite-media links after asserting that every active placeholder photo is also actively linked to `TLC-HS-0017`; and
- preserves the active monolith marker, its observed geometry, and both marker-photo links.

The migration does not infer relationships to nearby Burgess gravesites. Any future marker-to-gravesite or marker-to-marker relationship requires separate evidence and review.

## Consequences

The map no longer presents a false burial space at the family monument coordinate. `TLC-HS-0017` remains discoverable as a standalone purple-diamond monolith, and its photographs remain available from the marker detail panel. Historical soft-delete reasons preserve why the imported gravesite and pseudo-burial were removed.

## Rebuild And Validation

Run:

```bash
APP_ENV=dev npm run db:validate
APP_ENV=dev npm run db:migrate
npm run test:server
cd docs
bundle exec jekyll build
```

Verify that A-0017 and the pseudo-burial are inactive, TLC-HS-0017 is active with `monolith` scope and a null gravesite anchor, no active marker-to-A-0017 relationship remains, and both marker photos remain active.

## Update Triggers

Add a superseding ADR if evidence identifies real gravesites spanned by the Burgess monument, the marker is reclassified, or A-0017 is shown to represent a physical burial space after all.
