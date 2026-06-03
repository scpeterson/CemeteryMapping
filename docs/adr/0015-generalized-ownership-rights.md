---
permalink: /adr/0015-generalized-ownership-rights/
---

# ADR 0015: Model Ownership as Rights That Can Target Lots or Gravesites

[Documentation Home](../index.md) | [ADR Index](README.md)

## Status

Accepted

## Context

The cemetery hierarchy supports cemeteries, sections, lots, gravesites, burials, and headstones. Sections A-E of Trinity Lutheran Church Cemetery generally use 10 by 20 foot lots containing up to five 4 by 10 foot gravesites. Section G is different: it has no lots, uses the word `plot` for an individual 4 by 8 foot gravesite, and sells or deeds those gravesites directly.

The current production ownership model has two imperfect paths:

- `lot_owner_parties`, `lot_ownership_events`, and `lot_ownership_event_parties` model deeds and transfers at the lot level.
- The legacy `owners` table can attach owner text to a gravesite, but it does not model event history, event parties, shares, event types, or current-owner views with the same rigor.

That means Section G deed ownership and transfers of specific graves from a larger A-E lot do not fit cleanly. Treating a two-grave transfer as a fractional lot share also loses the operational meaning when the actual transferred rights are specific gravesites.

## Decision

Add a generalized ownership-rights layer:

- `ownership_parties`
- `ownership_events`
- `ownership_event_parties`
- `ownership_event_rights`

An ownership event represents the deed, sale, gift, church council action, correction, release, or other ownership action. Event parties represent who participated and their optional share. Event rights represent what was conveyed.

`ownership_event_rights.target_type` can be:

- `lot` for ordinary A-E whole-lot deeds.
- `gravesite` for Section G plots and specific transferred graves.
- `section` for section-level placeholder rights that are not yet tied to a lot or gravesite.
- `unlocated` for documented rights that still need review, such as "two graves from Lot 12" before the exact gravesites are identified.

The existing lot-specific ownership tables remain in place for compatibility. Migration `041-generalized-ownership-rights.sql` backfills generalized lot rights from existing `lot_ownership_events` and links the new rows back to their legacy source rows.

## Rationale

This design keeps the target of ownership explicit. A deed can now point to a lot when the cemetery actually sold a lot, or to gravesites when the cemetery sold individual plots. It also gives partial transfers a natural place in the model without pretending they are only fractional ownership of the entire lot.

The model preserves multiple owners and shares while reusing the existing ownership event type lookup values: `deed`, `sale`, `gift`, `church_council_action`, `correction`, and `release`.

The `unlocated` target type is intentionally conservative. It lets the database preserve a documented right before the spatial/data cleanup is complete, without fabricating lot or gravesite relationships.

## Consequences

Future deed registry promotion should target the generalized ownership layer, not the legacy `owners` table. Section G rows should promote to `gravesite` rights. Standard A-E lot rows should promote to `lot` rights. Ambiguous passageway, alias, or grave-count-only rows should remain staged or become `unlocated` rights only after review.

The grave-detail API reads both legacy `owners` rows and generalized ownership rights. Lot-level generalized rights are expanded to the gravesites in that lot for display, while direct gravesite rights appear only on their target gravesites. The detail panel can also create manual generalized ownership events for assigned power-users, cemetery-admins, and admins.

Audit triggers cover the new tables, so changes made through the API, import scripts, or direct database access are recorded in `audit_events`.

The lookup table is still named `lot_ownership_event_types` even though it is now reused by generalized ownership events. A later cleanup can rename or alias that lookup for UI clarity.

## Validation

Run:

```bash
npm run test:server
APP_ENV=test npm run db:validate
```

For a full database check, apply migrations to TEST and confirm:

```sql
SELECT count(*) FROM ownership_event_rights WHERE target_type = 'lot';
SELECT count(*) FROM current_ownership_right_owners;
```

## Update Triggers

Update this ADR if ownership rights add new target types, if the legacy lot ownership tables are removed, if deed registry promotion writes to these tables, if current-owner views change, or if ownership event type lookup naming changes.
