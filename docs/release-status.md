---
---

# Release status and deployment checks

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
