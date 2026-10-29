---
---

# ADR 0179: Shift the southern Section C lots and expand C-P03

- Date: 2026-10-29
- Status: Accepted

## Decision and authorization

Move the two southern rows, C-41–C-51 and C-70–C-90 (32 lots), by one
southward latitude offset. Use the more southerly of the offsets required to
put TLC-HS-0330 strictly inside C-80 and TLC-HS-0361 strictly inside C-82,
with one inch of mapped southern clearance at the controlling monument.
DEV requires approximately 13.981 inches south. The monument points remain
fixed; physical marker outlines are not measured by this containment check.

Rehearsal found C-85 and C-90 already outside the mapped cemetery boundary.
The owner explicitly approves clipping both after translation. They retain
non-burial status and existing dimension metadata, but their clipped polygon
shapes and areas change. Require no gravesite or ownership dependencies on
these two lots. The other thirty lot shapes and dimensions remain unchanged.
No gravesite, marker, ownership, section or cemetery geometry is modified.
Existing lot identifiers, assignments, restrictions and evidence remain intact.

Expand only C-P03’s southern edge into the vacated strip, meeting the moved
lots. Preserve its existing footprint and northern edge; clip to Section C and
subtract other active areas to avoid overlaps. Preserve its 30 original registry
references and any assignments. Record 33 lot-table update audit events.

## Validation and recovery

Run `APP_ENV=test node --test scripts/southern-c-lots.integration.mjs`,
`npm run lint` and `npm run db:validate`. Rehearse on actual DEV with rollback;
compare the 30 translated shapes, approved clipping, expanded passageway,
both marker containments, all unrelated lots and protected-table hashes.
Create a validated private DEV backup before `npm run db:migrate`; repeat
verification after application. Recovery uses that backup or a reviewed forward
correction; automatic SQL rollback is empty. Hosted TEST is unchanged. Do not
restart the local API, which the owner explicitly asked to stop.

## Relationship to passageway review evidence

This decision updates the C-P03 geometry described by
[ADR 0178](0178-passageways-and-individual-deeds.md). The archived
[Reevaluated passageways report](supporting/passageway-review-2026-10-29/reevaluated-passageways.html)
and its A/B/C map show the pre-504 southern C rows. The archived
[monument check](supporting/passageway-review-2026-10-29/monuments-outside-areas.html)
lists TLC-HS-0330 and TLC-HS-0361 as uncovered before this correction; both are
contained afterward. Preserve these earlier artifacts as rationale, not current
boundary instructions. The [current map guide](../map-layout-and-passageways.md)
records the final layout and the E/G gravesite-only policy.
