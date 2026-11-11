---
---

# Release status and deployment checks

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
