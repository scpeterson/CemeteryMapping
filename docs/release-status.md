---
---

# Release status and deployment checks

## 0.3.0 release baseline

Version **0.3.0** consolidates the merged workflows and fixes since v0.2.5; see the
[release changelog](https://github.com/scpeterson/CemeteryMapping/blob/main/CHANGELOG.md).
It includes inspection legibility/history, the enhanced report, shared lookups,
stacked graves, marker IDs and Section G sharing, map/deed fixes and UI updates.
Cemetery/section/block policy inheritance was added after this release baseline
and is deployed in the v0.3.0-based main revision recorded below. Publication and
exact-tag deployment follow [the release policy](adr/0016-versioned-releases.md#november-9-2026-current-release-policy);
a package bump alone does not establish deployment.

## November 24, 2026: environment consistency and managed local services

[PR #900](https://github.com/scpeterson/CemeteryMapping/pull/900) merged as
**`17046b4875270363074f1837006f07b9cc9b8403`** after all checks passed on its
final head: lint/unit/build, database/Docker startup, four browser shards and
[documentation validation](https://github.com/scpeterson/CemeteryMapping/actions/runs/45416705707).
The [Pages workflow for merged main](https://github.com/scpeterson/CemeteryMapping/actions/runs/45419188796)
also passed. PR checks, main CI and documentation publishing are separate runs;
none of them by itself redeploys a running application.

The last verified **application runtime** revision remains
**`aa4b0b7e6d95864524366de5e499a796e1618d05`**, version **0.3.0**, in DEV and both
TEST environments. PR #900 added operational tooling/documentation, not an
application cutover or schema migration. Different build timestamps identify the
separate builds; see the [dated runtime and capacity record](hosted-test.md#november-24-2026-runtime-consistency-and-hosted-capacity).

The November 24 audit confirmed equal application source/dependency
configuration, **22,113 rows in 78 business tables**, and **789 media files /
7,651,886,763 bytes** across all three environments. All active application
databases use PostgreSQL **18.6**, PostGIS/topology **3.7.0** and legacy TIGER
**3.6.4**. This supersedes the older local PostGIS 3.6.4 observation below;
historical databases keep their original extension versions. Users, access,
secrets, activity, audit history and migration-ledger rows remain separate.

Local database containers were backed up and recreated from the pinned image
with original volumes, database contents, users, credentials and ports preserved.
DEV and local TEST now run under macOS LaunchAgents. TEST serves its own API
snapshot and frontend build, independently of root `dist`; automatic recovery
was verified. The [managed runtime guide](environment-consistency.md#managed-local-services)
replaces the older temporary-process startup guidance below.

Hosted disk usage fell from **92%** to **80%**, leaving about **16 GiB** free,
after guarded offsite-verified retention and content-verified off-host image
archives. Disk/backup alerts were clear at verification. Current images, recent
rollback sets, manual holds, live media and database volumes were preserved.

With explicit approval, the dedicated Local TEST Auth0 client gained exact
port-5174 callback/logout/web-origin entries while retaining 5173; the separate
hosted client was unchanged. Fresh sign-in and existing-photo readback passed in
all three environments, including hosted Cloudflare Access. Existing mapped
identities were used; unmapped identities stayed denied. Upload/retry and
reader/offline workflows passed isolated browser tests (**63 passed**, one
source-only check skipped in built mode). This does not claim live uploads to
operational records, invitation delivery or real Turnstile submission.
The physical-phone offline observation/photo/reconnect test was **deferred by
the user**.

Use the [read-only parity command](environment-consistency.md#read-only-parity-verification)
for another audit and the [controlled refresh procedure](environment-consistency.md#controlled-dev-to-test-refresh)
for a reviewed DEV-to-TEST sync. Private evidence is retained under
`db/backups/20261124-runtime-consistency/`,
`db/backups/20261124-parity-managed-3/` and the two
`db/backups/20261124-hosted-*-image-archive/` directories. These local recovery
copies do not establish a new full host/media restore rehearsal.

## November 23, 2026: G-0001 shared-boundary placement verified

User-confirmed placement moved **G-0001** north onto the shared boundary of
**G-1/G-2** (stored gravesite IDs `G-001`/`G-002`), **0.3 feet east along that
boundary from its western junction**. The correction was applied to **DEV,
local TEST and hosted TEST**. Independent verification completed at
**2026-11-24T00:29:51Z** (November 23, **7:29:51 p.m. EST**).

The saved geometry is longitude **-80.07968915608267**, latitude
**40.60137031730726**. Fresh reads measured **0.3 feet** from the western corner
and **zero distance** from the shared boundary in all three environments; their
saved marker, gravesite and link records match. This records the owner's
requested placement, not a new survey measurement.

Validated full database backups and rollback rehearsals preceded the live
updates. Only the marker's geometry, latitude, longitude and update timestamp
changed. Gravesite polygons, existing marker/grave/burial links, all other marker
details and records, and existing audit history were preserved. The transaction
checked **16 protected tables**, retained audit and native constraint checks,
restored the timestamp trigger after applying a common timestamp, and added
**one attributed update audit event per environment**. All three APIs remained
healthy. No application code, schema migration or user/access setting changed.

Private backups, before-state records, guarded SQL and verification evidence are
retained locally under `db/backups/20261123-g0001-boundary-move/` and on the host
under `/srv/nhcemeteries/backups/20261123-g0001-boundary-move/`. The local
`verification.json` summarizes the independent result. Private records and
backup artifacts remain outside Git. See the [hosted correction record](hosted-test.md#november-23-2026-g-0001-shared-boundary-placement)
for recovery scope. Fresh interactive browser validation was outside this check.

## November 23, 2026: stale inspection-photo association resolved

The photo-link exception identified during the data sync below is resolved in
**DEV, local TEST and hosted TEST**. The stale association for marker
**TLC-HS-0573**, photo **IMG_6677.jpeg**, was soft-deleted in each environment at
**2026-11-23T19:47:47.838474Z** (2:47:47 p.m. EST). Verification completed at
**2026-11-23T19:49:02Z** (2:49:02 p.m. EST).

The photo and marker-photo link had already been soft-deleted on November 12
with the reason “Replacing incorrect photo,” but their association with the
October 21, 2026 inspection remained active. Validated database backups and
rollback rehearsals preceded the guarded one-row correction in each database.
Audit triggers stayed enabled; each environment received **one attributed
soft-delete audit event**. Only the association's `deleted_at` and `updated_at`
changed, using the same timestamp across all three environments.

Independent saved-state checks confirmed identical retained association rows,
preserved original details and existing audit history, unchanged photo/link/
inspection history, unchanged other photo contexts and **zero remaining active
photo-link inconsistencies** under the checked media/inspection/face rules.
The original photo file remains present with its SHA-256 unchanged. All three
APIs remain healthy. No application code, schema, users or access configuration
was changed; this was a targeted data correction.

Private backups, rehearsal/apply logs and the final `verification.json` are
retained locally under `db/backups/20261123-stale-photo-context/` and on the
host under `/srv/nhcemeteries/backups/20261123-stale-photo-context/`.
See the [hosted correction record](hosted-test.md#november-23-2026-stale-inspection-photo-association-correction)
for recovery details. This supersedes the sync record's known-photo-issue status
without claiming a broader data-quality audit or new interactive-login check.

## November 23, 2026: DEV data and media synced to both TEST environments

After the code deployment below, DEV was used as the authoritative source for
local and hosted TEST business data and media. Final verification was recorded
at **2026-11-23T19:41:54Z** (2:41:54 p.m. EST). All **22,113 full rows across
78 business tables** now match in all three environments, including UUIDs,
original timestamps, nested JSON, historical/deleted records and exact EWKB
geometry bytes. Final independent read-only snapshots found **zero differing
business tables**; hosted marker JSON numeric formatting was also aligned with
DEV so full-row text hashes match. This was a data operation: code, release
identity and schema version **523** were unchanged. The extension-owned
`spatial_ref_sys` catalog was outside the import; all **8,500** catalog rows
also matched across the three environments.

All **789 media files**, totaling **7,651,886,763 bytes**, match by size and
SHA-256. Local DEV and TEST share the same media directory, so no local file
publication was needed. Hosted TEST received **34 missing originals**
(325,818,358 bytes); its one TEST-only file was moved into protected recovery
storage. All pre-existing hosted file bytes remain in the verified media backup,
and the running API user can read all 789 published files.

Full DEV/local TEST/hosted TEST database dumps were taken and validated before
mutation, together with local media/configuration backups and hosted media and
settings snapshots. Both target syncs passed rollback and committed rehearsals
on isolated restores before live application. The live transactions verified
all **167 native foreign keys**, retained audit triggers, restored temporarily
suspended non-audit trigger states, and checked exact business-row equality.
Fresh verification confirmed DEV data/media stayed unchanged.

Each TEST environment retained these **12 protected tables**: `app_users`,
`app_user_activity`, `app_user_cemetery_access`, `access_requests`,
`field_operations`, `audit_events`, `system_events`, `databasechangelog`,
`databasechangeloglock`, `app_roles`, `audit_retention_policies` and
`system_event_retention_policies`. Accounts, memberships, access settings,
configuration and all existing audit history were preserved. The import
appended **6,818 local TEST** and **423 hosted TEST** audit events. No user or
permission remapping was required: DEV's referenced user IDs already existed
in the targets.

Both TEST APIs are healthy and anonymous cemetery-map requests return **401**.
Hosted HTTPS request-access returns **200**; restricted runtime database reads
confirm **692 active burials, 568 markers and 761 media assets**, matching DEV.
PostgreSQL remains 18.6 everywhere; local DEV/TEST PostGIS/topology remain
**3.6.4**, while hosted TEST remains **3.7.0** with legacy TIGER **3.6.4**.
Platform versions, migration execution metadata and environment-specific
account/operational history are outside business-data equality.

At the sync verification, DEV contained **one active photo context without an active media link**.
The first isolated rehearsal identified it; subsequent checks explicitly
preserved that exact exception and rejected additional ones. Its inspection
and face references are valid. This sync establishes parity with DEV, including
that known issue; it does not establish that every DEV relationship is clean.
The later [targeted correction](#november-23-2026-stale-inspection-photo-association-resolved)
resolved this exception in all three environments.
Fresh interactive sign-in, invitation delivery, real Turnstile submission and
physical offline field validation were outside this operation.

Private recovery and verification evidence is retained locally under
`db/backups/20261123-dev-test-sync/` and on the host under
`/srv/nhcemeteries/backups/20261123-dev-test-sync/`. The local
`sync-verification.json` summarizes the results. These directories include
pre-sync dumps, media/configuration snapshots, rehearsal/apply logs and
before/after comparisons; no private artifacts are committed. Review subsequent
TEST edits and retain each environment's own user/access state when planning
recovery. See the [hosted sync record](hosted-test.md#november-23-2026-dev-authoritative-data-and-media-sync).

## November 23, 2026: local and hosted TEST deployment verified

Both TEST environments now run version **0.3.0** at
**`f4debd575c74e9b96dcb2205e60b514077697566`**
([PR #894](https://github.com/scpeterson/CemeteryMapping/pull/894)), with the
complete changelog through **523-non-interred-inscription-capacity** applied.
This includes scoped policies, Add burial on existing gravesites and the
pre-need/Unknown interment fix. This is a v0.3.0-based main deployment, not
verification of the immutable v0.3.0 tag.

Exact-main [CI passed](https://github.com/scpeterson/CemeteryMapping/actions/runs/45241653400),
including lint, unit/deployment tests, builds, database/Docker checks, all four
browser shards and documentation validation. The separate
[GitHub Pages build/deployment passed](https://github.com/scpeterson/CemeteryMapping/actions/runs/45241652620);
live documentation pages returned HTTP 200 with the updated content.

### Local TEST

Local TEST required migrations **521–523**. A validated custom-format database
backup was restored into an isolated database; apply, rollback of all three,
reapply and Liquibase validation passed. All **85 original public tables**
(excluding Liquibase metadata) matched their pre-migration row counts and
content fingerprints after rehearsal and after the live migration. The isolated
database was removed, and the restricted API grants were refreshed using the
existing runtime credential.

The built TEST frontend is served at **http://127.0.0.1:5174/**, with its API on
**http://127.0.0.1:3003/**, leaving DEV on ports 5173/3001 unchanged. The frontend
returned HTTP 200; proxied API health reported TEST, the exact deployed SHA and
`cemetery_mapping_test` connectivity. Local API start metadata is
**`2026-11-23T19:03:31.397Z`** (2:03:31 p.m. EST); it is not the frontend build
time. Existing local TEST Auth0 settings are used, and anonymous map access
returned 401. All **six burial integration checks** and `npm run build:test`
passed. This was a built frontend served by Vite preview, not a registered
persistent service; a machine restart requires starting it again. A fresh
interactive sign-in at this port was not tested.

Protected local recovery copies are retained under
`db/backups/test-deploy-20261123/`; operational logs and process IDs remain in
the local temporary deployment directory. No backups, credentials, private data
or verification artifacts are committed to this repository.

### Hosted TEST

Hosted TEST advanced from **`f08cc5987ad4dde6b5bd53153c1b2c1acff045e0`** to the
revision above, built **`2026-11-23T19:06:14Z`** (2:06:14 p.m. EST). Migration
**523** was applied separately before the code deployment. Its isolated
backup/restore, apply/rollback/reapply and validation passed, and all **89
original public tables** (excluding Liquibase metadata) matched before/after
both rehearsal and live migration. The isolated database was removed and
restricted API grants refreshed with the existing host credentials.

The standard exact-commit deployment backed up the database, application,
settings and media; verified a candidate API; then switched API/web while
leaving the database and tunnel running. Release-manifest verification passed,
including **215 runtime source files** checked inside the API container. Health
confirmed TEST, version/SHA/build identity and database connectivity. Auth0 and
the restricted runtime role remain active, the API runs as `node` with private
mode-0600 environment files, and its restart count was **zero**. Anonymous
`/api/me` and map requests returned 401. The served frontend matched its release
hash, Nginx validation passed, and the public HTTPS request-access page returned
200. Accounts, media and protected configuration passed preservation checks.

The deployment report's `schemaChanges: false` describes the code cutover only;
it does not negate the separate migration 523 operation. Retained pre-migration
recovery evidence is under the host's protected
`staging/schema523-20261123` directory. Code-cutover recovery material is under
`backups/20261123T190614Z-f4debd575c74-831b2aef`; that database backup already
includes migration 523. Code rollback does not undo the earlier schema change.
See the [hosted deployment record](hosted-test.md#november-23-2026-main-revision-deployment-and-migration-523).

These checks do not establish a fresh interactive hosted login, invitation
email delivery, real Turnstile submission, physical offline field validation,
or STAGE/PRODUCTION deployment. Earlier dated records retain their original
scope; this deployment supersedes the older TEST availability observations.

## November 23, 2026: pre-need and Unknown interment verified in local DEV

Local DEV includes the pre-need creation/editing fix and migration **523**.
The Record status selector allows Pre-need inscription; Interment may remain
Unknown or not applicable before an actual burial. Pre-need and memorial records
are excluded from capacity counts. Recording a second actual interment beside
an existing urn still requires Urn under the two-urn policy.

The running DEV API and Vite server use the updated source, API health reports
DEV with database connectivity, and migration 523 is applied. A rollback-only
rehearsal of an existing pre-need record's change from Urn to Unknown passed all
constraints and preserved the saved record. Disposable database checks verified
creation, later interment, incompatible type rejection and migration
rollback/reapply. This verification does not establish hosted TEST deployment.

## November 20, 2026: scoped-policy deployment verified

Read-only live checks found hosted TEST already running **`f08cc5987ad4dde6b5bd53153c1b2c1acff045e0`**
([PR #882](https://github.com/scpeterson/CemeteryMapping/pull/882)), version
**0.3.0**, built **`2026-11-19T19:17:22Z`** (November 19, 2:17:22 p.m. EST).
Migrations **521/522** are applied. This is a v0.3.0-based main deployment;
it does not establish deployment of the immutable v0.3.0 tag. No deployment,
live migration, live policy save or service restart was performed for this review.

The exact revision's aggregate CI passed. All **1,775** deployed manifest files
matched their recorded SHA-256 hashes. Auth0 and the restricted `cemetery_api`
role are active, anonymous policy/map requests return 401, the API has zero
restarts, and the Liquibase lock is clear. All four policy metadata/history/claim
tables grant runtime SELECT without INSERT/UPDATE/DELETE; the guarded
SECURITY DEFINER change function is executable with its fixed search path.
There is one API container with a process-local preview key; another replica
would require a shared private preview secret as documented in
[Location policies](location-policies.md#deployment-and-preview-secrets).

Retained November 19 evidence records migration apply/rollback/reapply,
84 original table fingerprints preserved through the migration, successful
isolated permission/concurrency checks, live rollback-only previews and conflict
rejection. Its final preservation comparison matched 83 original tables exactly;
only the expected last-active timestamp changed in the activity table. The
756-file media inventory was preserved. These are dated retained results,
distinct from the fresh November 20 checks. Private reports and recovery
materials remain on the host; no settings or cemetery records are published here.

Fresh November 20 rehearsal restored the retained pre-policy backup into a
disposable database, applied 521/522, rolled back both, reapplied both and
validated the changelog. All **84 original table fingerprints matched**. A fresh
live TEST dump was then restored into that isolated database: Liquibase reported
it up to date and **21 policy integration/unit checks passed**, including
inheritance, ancestry, restoration, competing burial writes, guarded previews,
permission forgery, scoped history, stale edits and concurrent saves. The
disposable database was removed. All **90 live table fingerprints** matched
before/after the review; no live database mutations or service restarts occurred.
Private snapshot, logs and report are retained under the host's protected
`staging/policy-review-20261120` directory.

Local lint, **934 server/unit checks**, production TypeScript/build and bundle
budgets passed (adjusted core **695.37 / 702 KiB gzip**). The documentation site
built and changed-document file links passed. The policy browser profile now
excludes the API-dependent `app.spec.ts`, which remains in the main E2E suite;
see [the harness clarification](adr/0219-admin-location-policies.md#rehearsal-harness-clarification--november-20-2026).
All **49 isolated policy/adjacent browser checks passed** with one worker,
including the six policy-editor cases at desktop and phone widths. An earlier
parallel run had a marker scroll-tracking failure that passed both serial runs;
parallel timing remains a test-stability observation, not a proven runtime defect.

Host capacity on November 20 was **81% used, approximately 15 GB available**.
This supersedes the older capacity observation, without claiming a new backup
retention or offsite restore audit. Physical offline field work and the older
fresh-login/invitation/Turnstile verification gaps remain outside this review.

## November 18, 2026: pre-release marker baseline verified on TEST

Before preparing the named release, hosted TEST was verified at
**`5b17c362332850c0ec62615a95be4a31f9fa5a94`**
([PR #878](https://github.com/scpeterson/CemeteryMapping/pull/878)), package
**0.2.5**, build **2026-11-18T21:21:54Z** (4:21:54 p.m. EST), schema **520**.
The merged feature baseline is already deployed, including the enhanced report,
UI/map fixes, stacked graves and marker changes. This supersedes the older
pending-report status; the November 15 record below retains its historical scope.

Blank marker IDs and Primary/Spans saves passed deployed rollback-only checks.
Live signed-in forms confirmed the first-marker Primary default, Section G's
flat-only options and protection of the existing spanning G-0001 marker, and
broader choices in Section C. Existing markers, burials, geometry, links, source
history, accounts and media were preserved. The checks created no permanent
marker or burial, and did not refresh TEST from DEV. Protected backup, rehearsal
and recovery evidence is in the private operations repository; no private records
or backup material is published here. This baseline is not evidence of a named
v0.3.0 deployment; record that exact tag/SHA/build after cutover.

## November 15, 2026: Inspection face controls and source attribution deployed to TEST

At this November 15 verification, hosted TEST was **`60d628543781a7aa574264bd419d43137e3ac329`**
([PR #868](https://github.com/scpeterson/CemeteryMapping/pull/868)), package
**0.2.5**, build **`2026-11-15T18:41:27Z`**. Each inspection face has exclusive
Illegible/Blank controls, with corrected checkbox/label alignment and protection
for legitimate text. Current marker reading identifies its latest source
inspection independently of an older visit selected for review. Source history
remains separate and preserved. The earlier November 15 `018adb8` release
([PR #867](https://github.com/scpeterson/CemeteryMapping/pull/867)) added the
corresponding stored marker-face controls.

The release passed exact-commit CI and backup/candidate/cutover checks. The existing
system-admin TEST session verified layout, flags, text protection, attribution
and history in an unsaved draft, which was discarded. Six isolated desktop/phone
browser regressions and 14 deployed rollback-only database round trips passed.
No live inspection save or new account/permission changes were made. In the final
84-table comparison, only normal authenticated activity changed; business data
and source history matched. See the [deployment scope](hosted-test.md#november-15-2026-inspection-face-controls-and-source-attribution).

Schema is through **migration file 518**; PostgreSQL **18.6**, PostGIS/topology
**3.7.0** and legacy TIGER **3.6.4** remain in place. This code release did not
restart the database or apply a migration. The production core budget is now
**702 KiB**, explicitly allowing bounded application growth for this feature
([ADR 0213](adr/0213-inspection-face-status-and-reading-source.md)); this is not
a third-party exemption. Earlier disk/backup observations retain their dates
and are not new capacity audits. No STAGE/PRODUCTION deployment is claimed.

At this November 15 deployment, the unreadable-inscription report searched text
rather than structured Illegible status. Empty flagged faces did not themselves
match. The pending enhanced report above addresses that coverage in source,
without changing this dated deployment record.

## November 14, 2026: Assignment, PostGIS and grave feature lookups deployed to TEST

The separate completed releases assigned C-0384 to C-88 without changing its
geometry/marker (`cc38a6c`, [PR #865](https://github.com/scpeterson/CemeteryMapping/pull/865)),
upgraded PostGIS/topology to 3.7.0 while retaining legacy TIGER compatibility
(`81c8a07`, [PR #848](https://github.com/scpeterson/CemeteryMapping/pull/848)), and
added system-admin management of shared grave feature lookups (`abe04ce`,
[PR #866](https://github.com/scpeterson/CemeteryMapping/pull/866)). These supersede
the November 12 application/database versions below. See the [sanitized release
summary](hosted-test.md#november-14-2026-assignment-postgis-and-lookup-releases)
for verification limits; private recovery evidence remains in operations records.

## November 12, 2026: Security, dependency and MapLibre updates deployed to TEST

TEST is healthy on **`3763e2f062d88de9beb135c5023fe73f09b21d06`**, built
**`2026-11-12T16:22:52Z`**, with Node 24.22.3, patched request-parser dependencies,
nginx 1.30.6, cloudflared 2026.11.0 and MapLibre 6.18.0. The deployed production
npm audit reports zero known vulnerabilities. Liquibase stays at 4.33.0 and
TypeScript at 6.0.3. No database or media changes occurred.

All 84 application tables, schema metadata and 756 media-file hashes were
preserved. Runtime/manifest, public HTTPS, anonymous access denial and deployed-map
browser checks passed; fresh interactive login was not exercised. MapLibre growth
is reported as allowed. The hosted adjusted core has a small 0.13 KiB budget
overage (previously 0.10 KiB), and host disk usage remains high at 97% after
reclaiming build cache. See the [deployment record](hosted-test.md#november-12-2026-security-dependency-and-maplibre-release)
for scope, recovery files and follow-ups. Production is unchanged.

## November 11, 2026: What's new deployed to TEST

TEST is healthy on the exact merged main revision
**`87833b366068968920468c2d643c5ad6b51fa0fd`**, built
**`2026-11-12T01:29:22Z`**. This is a **v0.2.5-based main build**, not a new tag;
the existing v0.2.5 release tag remains unchanged. The version badge opens
installed-release notes for all roles and retains its original hover details.
See the [deployment record](hosted-test.md#november-11-2026-whats-new-test-deployment).

Exact-commit CI, candidate/hosted health, manifest checks and deployed-asset browser
fixtures passed. All 30,294 business rows, nine protected tables, identities,
schema metadata, settings and 756 physical media files were preserved; all 755
canonical originals matched SHA-256 hashes. Browser fixtures verified click,
hover, keyboard/focus and 320-pixel layout without sending writes; they did not
exercise fresh live authentication.

The original 701 KiB production budget remains unchanged and passed. A separate
configured TEST measurement was **99 gzip bytes over** that core threshold;
TEST-specific bundle sizing remains a follow-up. The retained media recovery
archive leaves about **3 GB free (97% disk use)**, requiring capacity/retention
follow-up. Historical evidence and pending live login/image-download/invitation/
replay/offline/Turnstile verification gaps remain intact. Publishing these two
documents to TEST changes documentation only.


## November 11, 2026: DEV API and frontend running v0.2.5

DEV's checkout was current, but its long-running API still reported v0.2.4.
The existing DEV services were restarted from main; API health and served frontend
version definitions both verified **v0.2.5**, revision **`9b9db34d5565`**, with
build/start metadata **`2026-11-11T21:34:56.217962Z`**. API verification passed
at **4:35:13 PM EST**. See the [DEV runtime update record](hosted-test.md#november-11-2026-dev-v025-runtime-update).

All 30,294 business rows, nine protected tables, user identities and schema were
unchanged. Nine DEV configuration/environment file hashes and existing launch
settings were preserved apart from intended version metadata. No migration,
dependency upgrade or source change was needed. TEST's application remained on
its existing v0.2.5 release. Historical records and pending live verification gaps
remain intact; publishing this record to TEST changes documentation only.

## November 11, 2026: deployed TEST documentation aligned with DEV

The deployed runbook and release-status copies were synchronized with DEV and
verified at **4:23:17 PM EST**. The [documentation sync record](hosted-test.md#november-11-2026-deployed-documentation-sync)
details the original-file backups, hashes and preservation checks. All 1,666
tracked non-environment files then matched DEV; the 1,664 non-target files,
202 running API files, 30,294 business rows, nine protected tables and eight
configuration files were unchanged.

TEST remains healthy on v0.2.5 at `d595d1c3c404ef1934e5b56d7e03362817f3b086`.
This is a documentation-only publication. Historical records and pending live
login/image-download/invitation/replay/offline/Turnstile gaps remain intact.

## November 11, 2026: complete business-data parity with DEV

TEST's **30,294 rows across all 76 business/reference tables** now match DEV
exactly, including UUIDs, timestamps, nested content and deleted history.
Independent read-only verification completed at **3:44:53 PM EST**. See the
[complete reconciliation record](hosted-test.md#november-11-2026-complete-dev-authoritative-business-data-reconciliation)
for scope, canonical ID changes, safeguards and private recovery evidence.

Twenty-four tables required changes: 2,683 creates, 1,988 shared-row updates and
2,464 TEST-only row removals. This includes ownership, burial, monument, grave/lot,
place, feature, NHG and historical inspection/photo data. Earlier TEST-local keys
were replaced with DEV's canonical business identities; old TEST audit payloads
remain intact. The nine protected authentication/operational/audit/migration tables
and eight host configuration files were preserved. All 41,230 existing audit
events remained unchanged, with 7,135 new import events appended.

A validated full backup and rollback rehearsal preceded commit. Audit triggers
and native constraints remained enabled; temporary non-audit trigger suspension
was transaction-local and all original trigger/schema state was restored. Exact
full-row comparison, 158 foreign-key checks, deployed repository reads and report
role/cemetery checks passed. DEV's business data and files were unchanged.

All 755 DEV original media files now match TEST by hash; only two missing files
(23,996,555 bytes) needed copying. All 754 pre-existing TEST files were preserved.
Ownership counts now match (57 active events, 70 parties, 147 rights), as do all
other business tables. The unreadable-inscription report remains at 51 monuments.

All 1,401 compared deployed source files match DEV. TEST remains **v0.2.5** at
`d595d1c3c404ef1934e5b56d7e03362817f3b086`, healthy with anonymous media denied (401).
Historical records and pending live login/image-download/invitation/replay/offline/
Turnstile verification gaps remain recorded.

## November 11, 2026: remaining inspections and photos reconciled; report returns 51

DEV-authoritative reconciliation is complete across all active monuments:
**566 latest inspections and 729 active photo associations** now match in DEV and
TEST after local identity normalization. See the
[remaining reconciliation record](hosted-test.md#november-11-2026-remaining-inspection-and-photo-reconciliation)
for scope, verification and protected recovery evidence.

Updated 31 existing latest inspections; added G-0001, its link to the existing
G-001 gravesite and its October 23 inspection. The automatically generated
baseline remains deleted to match DEV. Copied 22 original JPEGs (251,363,126 bytes)
and their media/link/context records, corrected five face assignments and copied
327 Primary flags. TLC-HS-0506's byte-identical TEST photo was retained under its
existing ID. Existing IDs/history, all 732 pre-existing files and unrelated records
across 83 public tables were preserved; DEV was unchanged.

A validated full backup and rollback rehearsal preceded the audited transaction.
Post-commit checks at **10:00:41 AM EST** and independent inventories found zero
substantive latest-inspection, active association or compared link-field
differences. API-user file hashes and deployed repository checks passed. The
unreadable-inscription report now returns the same **51 monuments** in both
environments, with independent SQL and role/cemetery checks passing.

TEST remains **v0.2.5** at `d595d1c3c404ef1934e5b56d7e03362817f3b086`; origin health
was healthy and anonymous media access remained denied (401). No code, schema,
configuration or protection changed. Earlier report counts/findings and pending
live login/image-download/invitation/replay/offline/Turnstile gaps remain recorded.

## November 11, 2026: 27 active inspection photos reconciled to TEST

TEST now has the **27 active inspection-photo associations** from DEV for
**25 of the 26 reconciled monuments**, verified read-only at **9:36:26 AM EST**.
See the [photo reconciliation record](hosted-test.md#november-11-2026-active-inspection-photo-reconciliation)
for scope, checks and protected recovery paths.

Imported 27 original JPEGs (318,970,966 bytes), 27 media records, 27 monument links
and 27 contexts mapped to TEST's local inspection/Front/Top face IDs. Primary
flags and display order match DEV. The deleted DEV association was excluded;
TLC-HS-0568 had no active photo association and remained unchanged.

Fresh comparison found **zero active association differences**. All source/target
file hashes match; the API runtime user can read all 27 files, and the deployed
photo-context and monument-detail repositories return all 27 associations/photos.
All 705 existing TEST files retained their hashes/ownership/permissions; unrelated
records across 83 public tables, inspection content, NHG data and accounts were
preserved. DEV was unchanged. A validated full backup and targeted import/file
manifests were retained, and 81 audited creates were verified.

The unreadable-inscription report remains at **48 monuments**, matching independent
SQL, with power-user/reader/cemetery policy checks passing. Anonymous media access
still returns 401; fresh authenticated live-browser login/download was not exercised.
TEST remains v0.2.5 with no code, schema, configuration or protection change.
Historical records and pending live login/invitation/replay/offline/Turnstile
verification gaps remain intact.

## November 11, 2026: latest inspections reconciled; report returns 48 monuments

TEST's **26 latest-inspection differences** were reconciled using DEV as
authoritative. Post-commit read-only verification passed at **8:55:39 AM EST**.
The [reconciliation record](hosted-test.md#november-11-2026-dev-authoritative-latest-inspection-reconciliation)
details the changes, preserved local identities and protected recovery material.

The October 21, 2026 observation dates, differing conditions/notes, inscriptions
and face content now match DEV. TEST inspection and existing Front-face IDs were
retained, and TLC-HS-0515 gained its Top face with a local UUID. All target
observations are marked manually edited to preserve the authoritative content.
Exactly 26 audited updates were verified. Unrelated records across 83 public
tables, older inspections, other manual edits, root monument records/faces,
NHG decisions and all existing photo associations were preserved. DEV was unchanged.
DEV's inspection photo links were not transferred; this is not photo parity.

Fresh read-only report comparisons now return **the same 48 monument IDs in DEV
and TEST**, including all 26 reconciled monuments. TEST's independent latest-
inspection SQL and power-user/reader/cemetery-scope policy checks passed. Rerun
**Reports → Data maintenance → Unreadable monument inscriptions** to refresh.
The earlier v0.2.5 deployment's 22-result report remains historical evidence.

No deployment/version/configuration/schema/protection change was made; TEST stays
on immutable v0.2.5. Fresh authenticated live login, invitation delivery, token
replay, offline synchronization and a real Turnstile submission remain pending.

## November 10, 2026: v0.2.5 adds the unreadable-inscription report

TEST runs immutable tag **v0.2.5** at
`d595d1c3c404ef1934e5b56d7e03362817f3b086`, built at 5:09:55 PM EST and verified
healthy at 5:12:19 PM EST. See the
[deployment record](hosted-test.md#november-10-2026-unreadable-inscription-report-release)
for exact-tag commands, CI, role/result verification, preservation and recovery.

Refresh TEST, then open **Reports → Data maintenance → Unreadable monument
inscriptions**. Deployed read-only policy checks confirmed power users can list/
run it, readers cannot, higher-role catalog access works and cemetery/mixed-role/
no-assignment restrictions hold. Results were **22 distinct monuments**, matching
an independent latest-inspection PostgreSQL query. Each row has inspection and
monument navigation metadata. These checks and release browser regressions do
not constitute a fresh authenticated live Access/Auth0 login.

DEV returns 48 matches. Read-only comparison explains the difference: 26 monuments
have different latest 2026 inspection text/face data; all exist in both environments,
with no TEST-only matches. This is separate from the reconciled NHG source records.
Those inspection differences were left unchanged to preserve TEST data and remain
for a separately authorized review/reconciliation.

Release PR and exact-main CI passed without rerun. Frontend/API metadata agrees
on TEST, 0.2.5, full SHA and build time, including public browser evaluation.
All 200 runtime hashes, 44 field URLs and 83 unchanged table fingerprints passed,
along with account/media/settings/protection preservation, restricted-role reads,
zero API restarts, invalid-token rejection without records and burst/cooldown.
Schema remains 518 changesets through file 516; no migration, database tag, data
repair/refresh/restore or configuration reset ran. Existing NHG reconciliations
were preserved.

Fresh live login, invitation delivery, token replay, disconnected offline
synchronization and a fresh real Turnstile submission remain pending. Earlier
dated records retain their scope; this does not establish STAGE/PROD deployment.

## November 10, 2026: v0.2.4 puts E-0567 first in main suggestions

TEST now runs immutable tag **v0.2.4** at
`880650634483dc6709e67c9dd6bd8b746fe989a0`, built at 11:57:25 AM EST and
verified healthy at 12:00:18 PM EST. See the
[v0.2.4 deployment record](hosted-test.md#november-10-2026-nhg-suggestion-priority-release)
for exact-tag commands, CI evidence, preservation results and recovery paths.

The deployed Readings repository returns **E-0567 at position 1 in Possible
existing matches** for page 230's final **UNKNOWN (6E, 3, s)** reading in the
latest default batch. Exact location is true; E-0567 and marker TLC-HS-0567 both
have empty evidence and zero saved decisions. Refresh TEST and filter Admin >
Readings to page 230; E-0567 no longer requires expanding the extra suggestions.
Verification used deployed code and a restricted database-enforced read-only
connection, with no confirmation or fresh authenticated UI login. Automated
regressions retain existing candidates, ordering and completed/pending review state.

Release PR and exact-main CI passed. The earlier PR run was superseded after
reopening delayed checks; no code correction was needed. Frontend/API identity
matches on TEST, 0.2.4, full SHA and build time, including fresh public browser
metadata evaluation. Checks passed for 198 runtime hashes, 44 field URLs, 83
unchanged table fingerprints, preserved accounts/media/settings/protections,
restricted-role reads, zero restarts, invalid-token rejection without records
and edge burst/cooldown. Schema remains 518 changesets through file 516. No
migration, database tag, repair, refresh or configuration reset ran.

Fresh live Access/Auth0 login, invitation delivery, token replay, disconnected
offline synchronization and a fresh real Turnstile submission remain pending.
Prior dated evidence is retained; this does not establish STAGE/PROD deployment.

## November 10, 2026: v0.2.3 suggests E-0567 from its NHG location

TEST now runs immutable tag **v0.2.3** at
`7f0d31d92bc8da9901b3104caef55846ff0cea7e`, built at 11:01:38 AM EST and
verified healthy at 11:04:28 AM EST. The
[v0.2.3 deployment record](hosted-test.md#november-10-2026-nhg-location-matcher-release)
contains exact-tag commands, CI evidence, preservation checks and recovery paths.

The deployed Readings repository returns **E-0567** and marker **TLC-HS-0567**
for page 230's final **UNKNOWN (6E, 3, s)** reading, in the latest default import
batch under **Show more possible matches**. Both remain unconfirmed, with empty
evidence and zero saved decisions. Refresh TEST, filter Admin > Readings to page
230 and expand the extra suggestions on that reading. This was verified through
deployed repository code with a restricted, database-enforced read-only connection;
no link or data correction was submitted and no fresh authenticated UI login ran.

Release PR and exact-main CI passed without rerun. Frontend/API metadata agrees
on TEST, 0.2.3, full SHA and build time, including fresh public browser evaluation.
All 198 runtime hashes, 44 field URLs and 83 unchanged table fingerprints passed,
along with account/media/settings preservation, restricted-role reads, zero API
restarts, invalid-token rejection without stored records and edge burst/cooldown.
Schema remains 518 changesets through file 516; no migration, database tag, data
refresh, repair or configuration reset was performed. Existing match paths and
authentication/edge/origin protections are preserved.

Fresh live Access/Auth0 login, invitation delivery, token replay, disconnected
offline synchronization and a fresh real Turnstile submission remain pending.
Historical verification scope is retained; this does not establish STAGE/PROD
deployments.

## November 10, 2026: v0.2.2 moves release identity into the header

TEST now runs immutable tag **v0.2.2** at
`4f3f0c2827750dc24621e4cff877c83c1d7aa199`, built at 10:08:18 AM EST and verified
healthy at 10:10:56 AM EST. Environment/version information is beside **Cemetery
Map**, outside the map, and remains visible in phone Search/Details. See the
[v0.2.2 deployment record](hosted-test.md#november-10-2026-header-placement-release)
for exact-tag commands, validation and protected recovery paths.

Full release PR and exact-main CI passed without rerun. Runtime frontend/API
metadata agrees on TEST, 0.2.2, full SHA and build time. Post-deployment checks
verified 198 runtime hashes, 44 field URLs, unchanged counts/fingerprints across
83 tables, existing configuration/accounts/media/protections, restricted-role
reads, zero API restarts, invalid-token rejection without stored records, and
edge burst blocking/cooldown. Schema remains 518 changesets through file 516;
no migration, database tag, data refresh or configuration change was performed.

The header placement is covered by automated browser regressions; the deployed
public metadata was separately evaluated in a fresh browser without submitting
a form. Fresh authenticated live login, invitation delivery, token replay,
disconnected offline synchronization and a fresh real Turnstile submission remain
pending. Previous release records retain their original scope. Refresh TEST to
load the new header layout; this does not establish STAGE/PROD deployments.

## November 10, 2026: v0.2.1 fixes TEST label and shows versions

TEST now runs immutable tag **v0.2.1** at
`4aaf0504a40a708a2359c0d6c69a1757bd27fb64`, built at 9:27:15 AM EST and verified
healthy at 9:29:41 AM EST. The [patch deployment record](hosted-test.md#november-10-2026-environment-label-and-version-badge-fix)
contains source/CI evidence, exact-tag command, preservation checks and recovery paths.

The frontend now resolves TEST from the selected build mode when environment files
are removed. Existing explicit overrides and hosted configuration are unchanged.
The map badge shows the environment and version in DEV/TEST/STAGE/PROD, stacking
them on phones; its tooltip retains SHA/build/API details. A fresh browser
evaluation of the deployed public metadata confirms TEST, version 0.2.1 and the
same full SHA/build time as the API. This closes the inherited label discrepancy
recorded for v0.2.0 without moving that tag.

Full PR and exact-main CI passed. Post-deployment checks verified 198 runtime
hashes, 44 field URLs, unchanged fingerprints across 83 tables, preserved settings,
accounts/media/protections, restricted-role reads, zero API restarts, invalid-token
rejection without stored records, and edge burst blocking/cooldown. Schema remains
518 changesets through migration file 516; no database or configuration changes ran.

Fresh authenticated login, real invitation delivery, live token replay,
disconnected offline reload/save/reconnect synchronization and a fresh real
Turnstile submission remain pending. The public metadata probe did not submit a
form or exercise a new login; STAGE/PROD label builds are not live deployments.

## November 10, 2026: v0.2.0 deployed to hosted TEST

The exact published tag **`v0.2.0`**, commit
`ed2266812b9bd852134c31c7c56a2a8cff3d57a1`, is deployed to TEST. Build time is
`2026-11-10T13:51:40Z` (8:51:40 AM EST); post-cutover health was verified at
8:54:50 AM EST. The [November 10 runbook record](hosted-test.md#november-10-2026-versioned-test-deployment)
contains the command, retained reports and recovery paths.

Exact-revision CI, candidate checks, 196 runtime hashes, 44 field URLs,
restricted-role reads across three cemeteries, 83 unchanged table fingerprints,
account/media/settings preservation, public/private routing and zero API restarts
passed. Schema remains at 518 applied changesets through file 516; no migration,
data refresh, database release tag or configuration reset ran. Missing/forged
Turnstile tokens created no records, and existing edge burst blocking/cooldown
remained effective.

Frontend/API **version, SHA and build time match**. The frontend still labels the
environment **DEV**, as did the retained previous build; API environment is TEST.
Hosted frontend settings omit `VITE_APP_ENV`, and the sanitized release build
does not load the tracked `.env.test` label. This pre-existing discrepancy remains
open for a separate reviewed fix; existing configuration was preserved.

Source follow-up: the frontend now derives a missing label from its Vite mode and
shows the version directly in the map badge in every environment. Explicit label
overrides and hosted protection settings are preserved. This source fix is not
part of the immutable v0.2.0 tag; the recorded live discrepancy remains until a
subsequent versioned release is deployed. See the
[frontend identity guide](frontend-development.md#environment-and-version-identity).

Fresh interactive login, invitation delivery, live token replay, disconnected
offline reload/save/reconnect synchronization, and a fresh real Turnstile-backed
submission were not verified by this deployment. Prior evidence remains dated;
this release does not establish STAGE/PROD availability or close pending gaps.

## November 9, 2026: 0.2.0 source release baseline

Version **0.2.0** establishes the first named source release; publication and
deployment are separate actions. See the [0.2.0 release notes](https://github.com/scpeterson/CemeteryMapping/blob/main/CHANGELOG.md)
and [current versioning policy](adr/0016-versioned-releases.md#november-9-2026-current-release-policy).
No deployment of 0.2.0 is established by its release-preparation PR or Git tag.

At release preparation, the latest recorded hosted TEST code was `0b6d9c9`, package **0.1.0**, built
November 9 at 12:05:48 PM EST. The [November 9 deployment record](hosted-test.md#november-9-2026-refactoring-and-draft-recovery-release)
documents preserved data/settings, schema through 516, 196 runtime hashes,
44 field URLs and zero API restarts. The later Cloudflare burst rule was a
separate edge configuration change, not a new application deployment.

Fresh hosted login after the dependency updates, real invitation delivery, live
Turnstile replay rejection, and disconnected offline reload/save/reconnect
synchronization remain pending. Dated sections below preserve earlier evidence
and its original scope; they do not close those gaps or establish STAGE/PROD.

## November 7, 2026: hosted TEST dependency release

The latest recorded hosted TEST deployment is
`3c5609f685d30a0c3104dd91eab27bc827b4f2e2`, built November 7 at 9:55:41 AM EST.
It includes PRs #802–#806: concurrently 10.0.6, Lucide React 1.67.0, Node types
26.6.6, JWT middleware 1.11.0 and Auth0 React 2.30.0. TypeScript stays at 6.0.3.
PR #806 also consolidates three shared chunks; local production-build core
JavaScript decreased from 700.28 to 699.46 KiB gzip under the unchanged 700 KiB
budget. See the [detailed November 7 TEST record](hosted-test.md#november-7-2026-dependency-and-bundle-release).

Exact-revision main CI and the normal backup/candidate/cutover release checks
passed. No migrations were required (schema remains through 516). Health,
196 runtime file hashes, HTTPS, anonymous API denial, zero API restarts,
account/media preservation, release-lockfile dependency versions, installed JWT
middleware and all 43 field-shell/manifest asset URLs passed verification.
Recovery paths and retained reports are in the detailed record.

**Offline reload remains pending:** real network-disconnected reload, a device
save while offline, and authenticated synchronization after reconnection. Fresh
interactive login and synchronization were not repeated after the November 7
Auth0/JWT updates. The November 6 connected reload/synchronization and automated
CI offline tests do not close this gap. Resume using the
[pending offline test steps](hosted-test.md#pending-hosted-offline-reload-test).

The dated DEV and earlier TEST records below retain their original verification
scope. This deployment does not establish STAGE or PROD availability.

## November 6, 2026: DEV

DEV was deployed at `9aec56d2b4bde06dde2491d530e78b30b12b32a6`.
The API health response identified this revision and the DEV database after the
dependency installation, DEV build and service restart. This is a dated deployment
record; later source merges do not automatically update running services.

| Change | Merged PR | DEV availability |
|---|---|---|
| Cemetery member administration | [#789](https://github.com/scpeterson/CemeteryMapping/pull/789) | Administration → Members |
| Concurrent edit protection | [#790](https://github.com/scpeterson/CemeteryMapping/pull/790) | Version checks and explicit conflict reload |
| Encrypted field collection | [#791](https://github.com/scpeterson/CemeteryMapping/pull/791) | Field workspace; offline shell requires a built deployment |
| Cemetery onboarding and reviewed imports | [#792](https://github.com/scpeterson/CemeteryMapping/pull/792) | Administration → Onboarding |
| Deleted-record recovery and person merges | [#793](https://github.com/scpeterson/CemeteryMapping/pull/793) | Administration → Recovery |
| CSV and GeoJSON extracts | [#794](https://github.com/scpeterson/CemeteryMapping/pull/794) | Export |
| Assigned maintenance work and reminders | [#795](https://github.com/scpeterson/CemeteryMapping/pull/795) | Tasks |

The feature release first reached DEV at `96dc8675c43bb99684f35c1e4a7b928fc519ada8`.
Migrations 513–516 were applied after a database/media backup, restricted API grants
were refreshed, and API/web services were restarted. PostgreSQL 18.6/PostGIS 3.6.4
remained in place. The later dependency-only release required no new migrations.

| Installed dependency | Version | PR |
|---|---|---|
| Vite | 8.3.5 | [#796](https://github.com/scpeterson/CemeteryMapping/pull/796) |
| MapLibre GL | 6.16.0 | [#797](https://github.com/scpeterson/CemeteryMapping/pull/797) |
| Lucide React | 1.66.0 | [#798](https://github.com/scpeterson/CemeteryMapping/pull/798) |
| ESLint | 10.14.0 | [#799](https://github.com/scpeterson/CemeteryMapping/pull/799) |

TypeScript remains 6.0.3. PR #273 was subsequently closed without merging, and
PR #801 ignores TypeScript 7.x Dependabot updates. See
[ADR 0204](adr/0204-maplibre-runtime-budget.md) for measured map runtime growth
and its bounded allowance; application chunk limits remain unchanged.

## Verification and limits

Each merged feature/dependency PR passed its final CI checks. Feature validation
included 310 fresh-database regressions; final dependency validation passed 854
server/unit checks. Live DEV read checks passed for members, imports, recovery,
merge search, field markers, task queues/reminders, CSV/GeoJSON exports and
protected media. Browser checks loaded the field workspace and the existing
sign-in screens for protected pages without application errors.

These deployment smoke checks did not perform a fresh interactive identity login
or write to real cemetery records. DEV's Vite server supports encrypted drafts
but does not provide the built offline shell. The observed DEV API used disabled local authentication; the frontend still
showed its sign-in screen. Personal task assignment/reminder checks require a
registered account and API authentication; a disabled-auth local session uses
the cemetery queue. A frontend login screen alone does not establish
API token validation. See [API security](https://github.com/scpeterson/CemeteryMapping#api-security)
and the [field workflow](operator-workflows.md#offline-field-collection).

## Promotion to TEST

Hosted TEST promotion completed on November 6, 2026 at
`8c01749e00129a88dcaa08bf9bedb518c5b22e6e`, including feature PRs #789–#795,
dependency PRs #796–#799, the plot-marker quality fix (#807), and the offline asset
manifest correction (#808). TypeScript remains 6.0.3; #801 suppresses TypeScript
7.x Dependabot updates. See the [detailed TEST deployment record](hosted-test.md#november-6-2026-hosted-test-release)
for the exact release metadata, preservation results and protected recovery paths.

Migrations 513–516 passed on an isolated hosted database copy before live
application. Existing-column fingerprints across all 79 existing application
tables were preserved, media was preserved, runtime grants were refreshed, and
no pending migrations remained. No DEV data refresh or demo reset was performed.
The final revision passed main CI and the normal candidate/backup/cutover release
procedure. Health, runtime/source integrity, HTTPS, anonymous API denial, account
and media preservation, and restricted-role read checks passed. All 46 checked
field-shell/manifest asset URLs were available after the manifest correction.

Fresh user-assisted Cloudflare Access/application login and field account
verification passed. Offline preparation completed; a downloaded marker and an
unchanged-value queued save survived a **connected** reload and encrypted
workspace unlock. Reauthentication and synchronization succeeded with zero
pending actions. No photo upload was included.

**Pending:** real network-disconnected reload, device save while offline, and
synchronization after reconnection. The user deferred this check because Wi-Fi
could not be disconnected. The prepared Trinity workspace remains in the browser
profile for later testing. Follow the [pending offline test steps](hosted-test.md#pending-hosted-offline-reload-test);
do not mark this check complete based on connected reload or CI simulation.

Interactive mixed-role authorization, conflict recovery, reviewed import approval,
person-merge/recovery mutations, photo synchronization and assigned reminder
behavior remain outside this live smoke verification. This promotion establishes
hosted TEST availability, not local TEST, STAGE or PROD deployment. Use the
[release workflow](operator-workflows.md#environment-promotion-workflow) for later
promotions.
