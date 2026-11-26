---
---

# Location policies and existing rule inventory

## Trinity Cemetery Exhibit B

Operators can open **Trinity rules** from the application menu when Trinity
Lutheran Church Cemetery is in scope. The reference summarizes the Council's
October 20, 2025 Exhibit B, including the marker types permitted in Sections
A–E and F–G, fees, eligibility, and notice periods. Use the source Exhibit B
and the applicable deed for operational decisions.

The reference includes both automated and operator-reviewed rules. In Section G,
the app enforces one casket plus up to one set of ashes or up to two sets of
ashes alone. The signed G-72 deed specifies one casket or up to three sets of
ashes in any approved cremation form, and separately allows a marker up to 36
inches wide. The app enforces the G-72 burial limit and applies its marker-width exception
only to a single-plot flush marker on G-72.

Enter measurements in inches in **Add marker** or **Edit marker information**.
Migration 525 validates supplied dimensions against Trinity's single-plot,
shared-marker and foot-marker limits. A shared marker must span two adjoining
plots in the app. Operators verify family eligibility and veteran status using
the applicable deed and records. Measure a flush marker's rise separately
from its overall height. An unrecorded measurement is treated as unknown, so
historical records can still be maintained. The two-ashes depth allowance uses
two recorded interments of ashes. A missing burial record may need updating
before recording the extended depth. Future plot-specific width exceptions
require a reviewed migration with the written approval reference.

Migration 524 stores the burial exception by gravesite UUID with a written
approval reference. To register another approved exception, use a reviewed
database migration that records the exact plot, limits, and written approval.
The application role has read access and cannot modify exception records.
The Section F rule prohibiting active gravesites still applies.

## Policy resolution

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
| `casket_or_two_urns` | Enforce plot burial capacity. At Trinity this permits one casket plus one set of ashes or up to two sets of ashes alone, subject to approved plot exceptions. Other cemeteries retain the one-casket or two-urn limit without mixing. Unknown interment types count as caskets. |

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

Admin → Policies provides the editor introduced by migration 522. System admins
manage every scope, including system defaults. Cemetery admins manage their own
editable cemetery memberships, including sections and blocks. Power users and
readers cannot access policy administration. The API and guarded database function
both enforce scope permissions; a submitted role or cemetery ID grants no access.
An active application account is required for previews and saves. Disabled-auth
local sessions can inspect policy metadata but cannot create attributed changes.

The runtime role has SELECT access to policy metadata and history, with no direct
DML on `location_policies`, `location_policy_revision`,
`location_burial_capacity_claims` or `location_policy_history`. Its only mutation
entry is `change_location_policy`, a narrow SECURITY DEFINER function with a fixed
search path, current-account/membership checks, hierarchy validation and a required
reason. Apply migrations 521/522 and re-run the reviewed API grants before starting
the new API; startup requires schema 525. Granting the function does not grant
catalog/history DML.

Policy changes require a nonempty reason and a READ COMMITTED transaction. Operator migrations remain available for reviewed configuration changes. A deployment should take its usual backup and
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

## Admin workflow

1. Open **Admin → Policies** and select System defaults (system admins only),
   cemetery, section and optionally block. Each rule shows its local value,
   effective value, source and the source’s reason.
2. Choose a supported rule and **Inherit**, **Enabled** or **Disabled**. Disabled
   explicitly overrides the same inherited restriction; Inherit removes the local
   row. Each key inherits independently. Changing scope resets the draft, and any
   draft change invalidates its preview.
3. Enter a reason and choose **Preview change**. The API applies the actual guarded
   mutation, runs deferred constraints, calculates the effective-rule footprint,
   then rolls back the policy, revision and proposed history row. Existing records
   are never edited by this operation. Conflicts block saving and explain whether
   graves, marker types/relationships, burial capacity or canonical references
   need review. Fix the scope or existing conflict; a policy cannot bypass integrity.
4. A successful preview shows counts of existing graves whose effective rule would
   change and their associated markers/burials. Future records also use the rule.
   Counts describe the rule footprint, not data edits. Marker and burial handlers apply through gravesite associations; unlinked monuments are not covered by this catalog. **Save policy** requires the
   exact successful preview, account, reason, scope, value and revision. Proof
   expires after five minutes. Saving revalidates current data, so newly introduced
   conflicts still prevent a save.
5. A concurrent policy change requires reload and a new preview. Table-lock waits
   and statement timeouts return a retry message. Review again after a busy result;
   do not repeatedly submit an old preview. Reopen affected record views after a
   successful save; stale forms remain protected by database checks.
6. **Recent policy changes** records actor email, time, immutable scope label,
   previous/local value, resulting local value and reason. **Older changes** uses
   stable keyset pagination; **Newest changes** returns to the latest page. Cemetery
   admins see only their permitted cemeteries’ history; system admins see all. History begins with migration 522; the existing adopted 521 policies retain their migration-adoption reasons.

Policy changes take effect on save. This editor does not schedule new effective
periods. Trinity’s stacking cutoff remains in **Admin → Records**, reusing the
existing cemetery fields and reservation grandfathering; there is no second cutoff
source in this catalog.

## Deployment and preview secrets

Preview proofs use an API-only HMAC key. The default is a random per-process key:
restarting the API invalidates outstanding previews safely. Multiple API replicas
must share a private `POLICY_PREVIEW_SECRET` of at least 32 bytes. Inject it using
the existing private environment/secret mechanism; never put it in a VITE variable,
tracked file or browser bundle. Changing it requires a new preview. Policy values,
reasons and actor IDs are bound to the proof; signing is additional protection,
while database authorization and constraints are still enforced at save time.

Migration 522 adds the append-only-to-runtime history table and guarded function.
Rehearse apply/rollback/reapply on a disposable database before deployment. A 522
rollback removes its function and history table, leaving the 521 policy values in
place. Back up/export history before rollback if changes have been made. A 521
rollback additionally refuses records incompatible with the former letter rules.

The admin workflow modules share one lazy admin bundle for compression. This loads
related workflows together when administration opens and keeps the existing core
bundle limit unchanged. The map/public entry does not eagerly import the editor.
