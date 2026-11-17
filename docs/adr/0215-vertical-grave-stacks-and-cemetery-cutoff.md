---
---

# ADR 0215: Vertical grave stacks and cemetery authorization cutoff

- Status: Proposed
- Date: 2026-11-17

## Decision

Keep ordinary graves ungrouped and unnumbered. Explicit cemetery-scoped groups
identify stacked graves, with positive levels counted from the bottom (1).
Each grave retains its identity, footprint, burials, rights and monument links.
No migration guesses stack membership or alters existing geometries.

Upper levels require an original authorization date and supporting reference.
Missing dates require review. This evidence is distinct from interment and entry
dates; living rights holders need no fictitious burial. The map indicates stacking
and offers individual levels rather than choosing solely by polygon drawing order.
The highest recorded level is Top, subject to completeness of group entry.

Add a typed cemetery-wide stacking cutoff and notes to Admin Records. Seed
Trinity Lutheran Church Cemetery with 2027-03-01, inclusive: no new authorizations
on or after that date. Honor earlier upper-grave reservations for later interment.
The same policy does not automatically apply to other cemeteries. Historical
entry is allowed using documented original dates. Database constraints/triggers
protect direct SQL; API checks provide actionable errors. Cemetery-scoped admin
roles control assignments and rules; existing power-user edits remain available.
Authorization evidence follows ownership visibility, not public map summaries.

This provides one typed policy rather than a general-purpose rule engine. It
does not change lot-capacity limits, burial-use restrictions, spatial validation,
or the existing workflows for creating graves and linking monuments. A stack
may temporarily have incomplete membership during manual setup. Group names
are case-sensitive; use one agreed name for all members.

## Delivery and validation

Migration 519 is additive, audits groups, uses a composite cemetery foreign key,
and enforces unique active levels. API startup requires it. Refresh the restricted
runtime role's grants after migrating. A schema rollback removes stack evidence;
prefer reviewed forward repairs once real assignments have been entered.

The small Records and Lookups editors now load with the lazy administration
shell, sharing compression rather than separate tiny chunks. The shared Button
joins the existing shared UI chunk. Administration remains lazy from the map;
application and vendor bundle budgets are unchanged.

Run the server, lint, production build and browser checks listed in the
[operator guide](../operator-workflows.md#vertically-stacked-graves-and-cemetery-stacking-rules).
Rehearse the migration on a disposable copy. Database tests cover missing
upper evidence, inclusive cutoff dates, earlier reservations and later interments,
level uniqueness, cemetery isolation, shared markers and unchanged geometry.
Browser tests cover desktop/mobile editing, rejection feedback, clearing and map
level selection. See the [operator workflow](../operator-workflows.md#vertically-stacked-graves-and-cemetery-stacking-rules).
