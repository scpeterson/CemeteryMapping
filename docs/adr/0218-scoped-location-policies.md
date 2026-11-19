---
---

# ADR 0218: Typed policies scoped by location identity

- Status: Proposed
- Date: 2026-11-18

## Decision

Replace runtime section-letter restrictions with a small typed policy catalog,
resolved by stable identity from system to cemetery to section to block. Each
rule inherits independently and supports an explicit false override. Seed the
restrictions of existing F/G and creation-restricted E/F/G section identities once;
do not automatically restrict future sections with the same letters.

Reuse the database enforcement handlers and single-marker claim, adding policy
validation, ancestry validation, deferred conflict checks and a policy revision
lock for concurrent snapshot safety. Return resolved rules to forms through the
API, including restrictions on all graves associated with a shared marker.
Keep runtime policy DML disabled and require migration 521 at API startup.

## Boundaries

Security and data-integrity invariants cannot be disabled. Existing cemetery-scoped
stacking cutoff fields remain authoritative. Existing geometry, identifiers,
reservations, markers, burials and historical migrations are preserved. This step
does not introduce an Admin → Policies editor, arbitrary expressions, a second
stacking cutoff, or new rules for another cemetery.

## Validation and follow-up

Regression coverage includes inherited values, explicit overrides, same-letter
cemetery isolation, scope validation, conflicting existing data, restore checks,
shared markers, concurrent marker writers, stale policy snapshots and responsive
form behavior. Rehearse apply/rollback/reapply and compare protected records on a
disposable database. See [Location policies](../location-policies.md) for the
complete inventory, typed catalog, operational procedure and next editor step.
