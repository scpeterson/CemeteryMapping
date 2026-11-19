---
---

# Location policies and existing rule inventory

Migration 521 introduces a typed policy foundation. Policies resolve per rule in
this order: system default → cemetery → section → block. The nearest explicit
value wins; `false` is an explicit override, and absence means inherit. With no
configured value, each restrictive handler defaults to `false`.

Scopes use cemetery, section and block UUIDs. A section named G in a new cemetery
does not acquire Trinity’s rules. Renaming a section with canonical gravesite
section UUIDs retains its policy. Legacy grave labels resolve only within their
own cemetery; ambiguous labels fail rather than selecting an arbitrary section.
Use canonical section/block UUIDs when importing or reassigning records; block
policies require the block’s canonical section parent and canonical references on its existing graves; unresolved legacy block members must be canonicalized before a policy can be added. Policies cannot attach to
a section or block in a different cemetery. The database checks grave ancestry,
including changes to scoped parents.

## Typed catalog

| Rule key | When enabled |
| --- | --- |
| `no_gravesites` | Reject active gravesites, including restoration. |
| `no_interactive_creation` | Reject the Add gravesite workflow at that location; existing/imported graves remain valid. |
| `flat_markers_only` | Permit only Flat marker for every active directly or explicitly associated marker. |
| `single_primary_marker` | Permit zero or one flat marker per grave, with Primary or Spans relationships. A shared marker counts once on each linked grave. |
| `casket_or_two_urns` | Permit one casket or up to two urns, never a mixture. Unknown interment types continue to count as caskets. |

These are deliberately small, tested handlers, not user-written formulas or SQL.
Adding a new kind of rule requires an application migration, enforcement and
regression tests. In particular, disabling `flat_markers_only` does not relax the
flat-marker requirement built into `single_primary_marker`.

## Existing behavior adopted once

Migration 521 records the old restrictions on the identities of existing sections:
F prohibits gravesites; G permits only one primary/spanning flat marker and one
casket or two urns; E/F/G prohibit interactive gravesite creation. This is a
one-time adoption of existing section identities, including retired sections.
New sections inherit policies from their parents, regardless of their letters.
No marker, burial, geometry, reservation, ownership record or identifier is
rewritten. Existing Section G marker claims retain their internal table and
constraint names for compatibility, but enforcement now uses resolved policies.

Map summaries and grave details include `locationPolicies`. Marker details include
`flatMarkersOnly`, combining restrictions from all active linked graves, so a
marker spanning a restricted and an unrestricted location remains restricted.
Forms use those resolved values; API preflight and database checks protect stale
forms, direct writes, link edits, restoration and location changes. The creation
workflow resolves the selected section and lot’s block and records that block on
the new grave. It still requires an eligible covering lot.

## Inventory of other rules and invariants

| Existing rule | Classification / handling |
| --- | --- |
| Trinity’s March 1, 2027 stacking authorization cutoff | Already scoped by cemetery UUID in `cemeteries`; unchanged. Earlier authorizations and reserved upper graves remain honored. Future policy editing must reuse this source instead of creating a conflicting second cutoff. |
| Stack level ordering, same-cemetery stacks and authorization requirements | System integrity; cannot be disabled by a location policy. |
| Unique marker identifiers and duplicate-safe automatic numbering | System integrity plus existing per-cemetery numbering inference; unchanged. |
| Foreign keys, cemetery isolation, user assignments, roles and audit context | System integrity/security; cannot be overridden by a narrower policy. |
| Whole-lot rights, passageways and non-burial lots | Existing explicit lot/right attributes and ownership validation; unchanged. Do not infer these from a section letter. |
| Interactive gravesite size, covering-lot requirement and `TLC-GPS-` numbering | Existing creation-workflow behavior; unchanged. Generalizing the geometry/identifier templates is a separate typed-handler extension before onboarding another real cemetery. |
| Trinity/North Hills evidence inclusion defaults and report/import section filters | Provenance/workflow-specific behavior, not a general restriction on graves or markers. Retained for separate review before onboarding another real cemetery. |
| Historical data-repair migrations and source-document labels | Historical evidence; never rewrite their checksums or reinterpret source labels as current policies. |

## Operator controls and rollout

There is no policy editor or policy mutation API in this step. The runtime role has
SELECT access to policy metadata, with no DML on `location_policies` or
`location_policy_revision` or `location_burial_capacity_claims`. Apply migration 521 before starting the new API; its
schema contract rejects an older database. Re-run the reviewed API role grants
after migration, as for other releases.

Policy changes currently require an owner-reviewed migration, a nonempty reason,
and a READ COMMITTED transaction. A deployment should take its usual backup and
rehearse on a disposable database first. Policy edits lock the affected data
tables, then deferred checks reject configurations conflicting with existing
active records. A revision row also forces older REPEATABLE READ data writers to
retry instead of committing against an obsolete policy snapshot. Data writers
share the revision lock; ordinary writes are not serialized with each other by it.
The single-marker claim remains the concurrency backstop for competing markers. `location_burial_capacity_claims` serializes competing capacity-limited burial writes and deferred checks protect both READ COMMITTED and REPEATABLE READ without updating grave timestamps or audit history.

Before changing ancestry, fill canonical section/block references for legacy
records. Renaming a section with a scoped policy is rejected while active graves still rely on its legacy label; establish their canonical section UUIDs first.
For a read-only inspection of configured values, use:

```sql
SELECT cemetery_id, section_uuid, block_uuid, rule_key, enabled, reason
FROM location_policies
ORDER BY cemetery_id NULLS FIRST, section_uuid NULLS FIRST,
         block_uuid NULLS FIRST, rule_key;
```

For a particular grave, inspect `gravesite_location_policies(id)`. The resolver
`resolve_location_policy(cemetery_uuid, section_uuid, block_uuid, rule_key)` is the
authoritative inherited value. Explicit `false` overrides must remain visible in
reviews; they are not missing configuration.

Rollback restores the previous function definitions and removes the new catalog.
If new policy configurations or data cannot satisfy the former global F/G rules,
resolve that incompatibility or restore the approved backup before rolling back.
Never roll back around an existing conflicting marker or burial.

## Next step

Build Admin → Policies with inherited/source explanations, controlled overrides,
conflict preview, an audit trail and permission rules. Add effective-date handling
by reusing the existing stacking authorization semantics. That editor and any new
cemetery’s policy choices are separate work; this foundation does not authorize
runtime users to change policy.
