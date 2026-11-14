---
render_with_liquid: false
---

# PostgreSQL 18 volume layout and upgrades

[Documentation Home](index.md) · [Rebuild Guide](rebuild.md) · [ADR 0193](adr/0193-postgresql18-volume-layout.md) · [ADR 0194](adr/0194-local-database-review-tools.md)

All environment definitions build **PostgreSQL 18.6 / PostGIS 3.7.0** as
`cemeterymapping-postgis:18-3.7-tiger3.6.4` using
[`deploy/database/Dockerfile`](../deploy/database/Dockerfile). The runtime and
SQL-only legacy TIGER donor are pinned by digest. This preserves restore
compatibility for databases containing `postgis_tiger_geocoder` 3.6.4, which is
no longer included upstream in 3.7. No old shared libraries are copied.
This applies to root Compose DEV/TEST/STAGE/PROD and hosted TEST. PostgreSQL 18
stores its cluster at `/var/lib/postgresql/18/docker`; its named volume must mount
at `/var/lib/postgresql`. The old `/var/lib/postgresql/data` mount is rejected even
when empty. See the [upstream image documentation](https://github.com/docker-library/docs/blob/master/postgres/README.md#pgdata)
and [startup checks](https://github.com/docker-library/postgres/blob/master/docker-entrypoint.sh).

A fresh environment can use the usual `db:up`, `db:migrate`, and `db:configure-api`
commands. Existing PostgreSQL 17 clusters require a logical dump/restore into a
**different volume**. Changing the image or mount does not upgrade their files.
The entrypoint detects the old cluster and refuses startup rather than silently
initializing a replacement database. Existing named volume identities are retained
in the base Compose file so this detection remains effective.

Hosted TEST uses the separate `database_pg18` volume, explicitly named
`nhcemeteries-test-postgresql18`, mounted at `/var/lib/postgresql`. The original
`database` volume is retained for recovery and must never be mounted on PostgreSQL
18. STAGE/PROD are not yet provisioned; their definitions select the same image.
Historical ADR version tables describe their original decisions.

## Rehearse before changing a persistent environment

Run `node --test scripts/postgres18-startup.integration.mjs` with Docker available.
It creates uniquely named containers and volumes without published ports, reproduces
the old-mount error, checks fresh 18 startup, verifies refusal of a 17 cluster,
reopens that cluster on 17, and restores a spatial-data dump into 18. It removes only
its own disposable resources. CI also applies and validates the complete Liquibase
changelog on PostgreSQL 18 and runs the database/API/browser regressions.

For an existing installation, rehearse the following procedure on a backup copy
and compare record counts, spatial validation, ownership, photos and application
workflows before scheduling the actual cutover. Retain the source commit, old
volume name, database dump, media backup and pre-upgrade counts. Do not run
`docker compose down -v` or remove the old volume as part of the upgrade.

## PostGIS 3.6 to 3.7 within PostgreSQL 18

These definitions do not indicate that an existing database has been upgraded.
Normal hosted API/web releases leave the database container unchanged. Schedule
an explicit database maintenance window after rehearsing on a disposable backup
copy. Keep the original image, dump and volume snapshot for recovery. Never open
a database modified by the new extension SQL with the old image as a rollback;
restore the pre-upgrade backup into a separate volume instead.

Build the compatibility image from the checked-out release (`docker compose build
db` locally; `docker compose -f deploy/test/compose.yaml build db` for the
hosted definition). During an approved cutover, stop application writers, take a
final backup, and recreate only the database service using its existing PostgreSQL
18 volume. Connect as database administrator to **each application database** and
run:

```sql
ALTER EXTENSION postgis UPDATE;
ALTER EXTENSION postgis_topology UPDATE;
SELECT extname, extversion FROM pg_extension ORDER BY extname;
SELECT postgis_full_version();
```

Run the topology command only where that extension is installed. Core PostGIS and
topology should report 3.7.0; the retained TIGER extension stays at 3.6.4. Do **not**
use `postgis_extensions_upgrade()` for this combination: it attempts a nonexistent
TIGER 3.7.0 update. Compare stored geometry, all business tables, spatial findings
and API map/detail responses, then restart and repeat reads before restoring
application traffic. Existing spatial overlaps are a separate data review.

The TIGER donor remains intentionally pinned. Updating either base requires a
review of restore compatibility, dependency security and the regression rehearsal;
replace the legacy donor with a supported standalone TIGER release in a separately
reviewed change. See [PostGIS 3.7 release notes](https://postgis.net/2026/10/PostGIS-3.7.0/).

The startup integration suite also rehearses a same-volume 3.6→3.7 upgrade and a
pre-upgrade logical dump restore, preserving polygon EWKB, TIGER user data and
address normalization across restart. It uses disposable resources only.

## Inventory the whole cluster

Before taking the final backup, list every non-template database, including
historical snapshots and the administrative `postgres` database:

```sql
SELECT datname FROM pg_database WHERE NOT datistemplate ORDER BY datname;
```

The single-database example below is sufficient only when the application database
is the only database containing data to preserve. Otherwise, create a separate
custom-format archive for each database and restore each into the new cluster.
Record database owners, connection limits, locale, comments, database and role
settings, and grants before temporarily disabling writes. Inspect templates for
local customizations as well.

For custom ownership and permissions, also save `pg_dumpall --globals-only` in the
protected backup directory and retain ownership and ACLs in each database archive
(omit `--no-owner --no-acl` from both dump and restore). Review the globals before
restoring: the destination image already creates its initial administrator role.
Restore the remaining roles before database objects. Globals can contain password
hashes and must remain private. Reapply database-level settings and grants
explicitly; a database archive restored without `--create` does not recreate all
of that database's metadata.

Preserve multi-schema `search_path` settings as a list of identifiers. For example,
`SET search_path TO "$user", public, topology, tiger` differs from assigning the
entire comma-separated list as one quoted schema name. Validate the resulting
setting before checking views or starting the API.

## DEV example: dump, restore, and retain the old volume

The commands below use DEV and the standard container/user/database environment.
Use the matching environment, container and separate volume name for TEST, STAGE
or PROD. Stop application writes and background jobs before taking the final dump;
keep them stopped until validation is complete. Do not seed an upgraded database.

1. While the PostgreSQL 17 container is still running, record its identity and make
   a restricted backup directory:

   ```bash
   umask 077
   mkdir -p db/backups/postgresql18
   git rev-parse HEAD > db/backups/postgresql18/source-commit.txt
   docker inspect cemetery-mapping-db-dev --format '{{range .Mounts}}{{if eq .Destination "/var/lib/postgresql/data"}}{{.Name}}{{end}}{{end}}' > db/backups/postgresql18/old-volume.txt
   docker exec cemetery-mapping-db-dev sh -c 'psql -X -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SELECT version(), PostGIS_Full_Version()"' > db/backups/postgresql18/old-version.txt
   docker exec cemetery-mapping-db-dev sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner --no-acl' > db/backups/postgresql18/dev.dump
   ```

   Check that the dump command succeeded and validate the archive with `pg_restore
   --list` using a compatible PostgreSQL client. These backups contain private
   records. Keep the ignored backup directory protected and retain its external
   backup according to the existing recovery procedure. Standard app roles are
   recreated by `db:configure-api`; installations with additional PostgreSQL roles
   or grants must also back up and review those separately.

2. Stop the old database without deleting its volume:

   ```bash
   APP_ENV=dev npm run db:down
   ```

3. Select a fresh destination volume by adding this entry to the local, ignored
   `docker-compose.override.yml`. If that file exists, merge the entry into it;
   do not replace unrelated settings. Check that the chosen destination name is
   unused before starting it. Keep this override for subsequent normal commands.

   ```yaml
   volumes:
     cemetery-postgres-data-dev:
       name: cemeterymapping-dev-postgresql18
   ```

   Root Compose automatically reads this override. The old volume remains under
   the name recorded in step 1; the new volume uses the PostgreSQL 18 directory
   layout. Keep environment-specific overrides separate when upgrading other
   environments.

4. With the upgraded checkout, initialize the new database and restore the dump:

   ```bash
   APP_ENV=dev npm run db:up
   docker inspect cemetery-mapping-db-dev --format '{{.State.Health.Status}}'
   ```

   Wait until the reported health is `healthy` before restoring:

   ```bash
   docker exec -i cemetery-mapping-db-dev sh -c 'pg_restore --exit-on-error --clean --if-exists --no-owner --no-acl -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < db/backups/postgresql18/dev.dump
   APP_ENV=dev npm run db:migrate
   APP_ENV=dev npm run db:configure-api
   APP_ENV=dev npm run db:status
   npm run db:benchmark -- --env dev --refresh-statistics
   APP_ENV=dev npm run db:validate:spatial
   ```

   Refresh planner statistics after restoring and applying pending migrations, before
   judging query performance. The benchmark command explicitly runs `ANALYZE`,
   records before/after timings and plans, and checks spatial record fingerprints.
   Use `--env test` for local TEST. See [benchmark details](#planner-statistics-and-query-benchmarks).

   The restore cleanup flags remove the PostGIS image’s precreated extension
   schemas (including `tiger`) before recreating them from the archive on 18.
   Use them only against this fresh destination volume, never the source database
   or a destination that already contains application edits.

   Do not resume application writes if restore or validation fails. Compare the
   restored data with the recorded baseline, confirm PostgreSQL 18 and PostGIS
   3.6, and restart the API with its existing authentication settings after the
   checks pass. API-role grants must be refreshed after restore; the configuration
   command preserves the existing environment's API password.

## Verify preserved data and application behavior

Compare the source and restored databases while writes remain stopped. For each
database, retain table counts and deterministic row fingerprints, sequence values,
large-object data, custom ownership and grants, and extension configuration data.
Compare stored geometry values as part of the row fingerprints. Keep verification
manifests private alongside the archives. Count all stored graves separately from
map-visible graves: soft-deleted records are preserved but excluded from the map.

Record spatial validation findings before upgrading. New PostGIS, GEOS and PROJ
versions can change calculated area text slightly even when stored geometries are
identical. Investigate differences by issue identity, severity, and reviewed
exception status; unchanged counts alone do not prove equivalent findings. Report
pre-existing errors explicitly rather than describing a failing spatial validation
command as passing.

Exercise the map, search, grave and headstone details, report catalog, and photo
retrieval against restored data. A temporary loopback-only API with read-only
database sessions can verify these workflows without changing the normal API's
authentication settings. Compare media file hashes with the backup manifest.
Restart the normal API with its original environment and confirm health and
unauthenticated access rejection when authentication is enabled.

### Local DEV and TEST validation record, 2026-10-30

The local DEV and TEST clusters were migrated from PostgreSQL 17.5 to 18.6 with
PostGIS 3.6 using separate destination volumes. Both clusters retained all 808
stored graves per application database, including soft-deleted records; 785 active
graves per environment were visible through the map API. TEST's three historical
snapshot databases and both administrative databases were also preserved.

Table fingerprints, sequence values, large-object data, extension configuration
data, custom object ownership and grants matched after restoration and cutover.
All 714 media files matched their original SHA-256 hashes. Schema migrations were
already current, runtime API grants were refreshed, and both containers were
healthy. Read-only API and browser checks covered map rendering, search, grave
selection, headstone details, report catalog and photo retrieval. DEV's normal API
was restarted with Auth0 enabled and verified to reject unauthenticated access.

Spatial validation remained failing on pre-existing data: 158 unreviewed errors
in DEV and 135 in TEST. Issue identities, severities and unreviewed error counts
were unchanged. Calculated area text changed for 26 DEV findings and 23 TEST
findings, by at most 0.000006 square meters. Stored data fingerprints matched.

Original PostgreSQL 17 volumes, protected archives, media backup, integrity
manifests and the detailed migration report were retained locally. The ignored
Compose override selects the new volumes for subsequent local database commands.
Machine-specific settings, credentials and private records are not published in
this validation record. The hosted TEST stack was not migrated.

## Hosted TEST cluster procedure

Local TEST and hosted TEST are independent clusters. A local upgrade does not
change the hosted image or its databases. Use the same pinned image in
`deploy/test/compose.yaml`, but migrate the hosted cluster separately:

1. Acquire the hosted deployment lock. Inventory every database, role, membership,
   database/role setting, template customization, volume and image. Check free
   space for a separate cluster and protected backups.
2. Back up all non-template databases with ownership/ACLs and database creation
   metadata, plus cluster globals, deployment secrets and matching media. Validate
   each archive. Record deterministic application-table/geometry hashes, extension
   configuration rows, sequence values and `is_called`, large objects, ownership,
   grants and normalized spatial findings. Keep password-bearing globals private.
3. Restore into a separate PostgreSQL 18 volume using an isolated container on a
   temporary loopback port. Restore roles before database objects; preserve the
   existing API credential. Use an independent maintenance database when restoring
   `postgres`. Run `ANALYZE` in every restored database.
4. Verify all preserved data and metadata. Compare logical extension configuration
   data separately from extension-supplied objects; PostGIS can change its internal
   index names. Keep application-index ownership/grant checks intact. Preserve
   `search_path` as a schema list, not one quoted string containing commas.
5. Compare spatial issue identities and effective severities. Review calculated
   area-text differences separately from stored geometry. Exercise map, search,
   details, lookups, profiles and reports using the restricted API role against the
   restored copy. Do not enable normal writes on the rehearsal endpoint.
6. Stop API/web for the final consistent backup and restore. Repeat preservation
   checks; remove the temporary maintenance database. Stop the rehearsal container
   and old database, install the PostgreSQL 18 Compose definition, and start `db`
   on the verified destination volume. Check exact versions and fingerprints again
   before starting API/web with their existing authentication and secrets.
7. Verify health, anonymous-access rejection, public page/media delivery, runtime
   role restrictions, GeoNames and application reads. Record evidence and retain
   the original PostgreSQL 17 volume, archives and prior Compose definition.

Before accepting new writes, recovery can restore the original Compose definition
and retained volume. Once new writes have resumed, preserve/reconcile those edits
before falling back; the old cluster is a pre-upgrade snapshot. Never use
`docker compose down -v` as an upgrade or recovery step. Ordinary code releases
must retain the PostgreSQL 18 image and destination volume.

## Hosted TEST validation record, 2026-11-05

Hosted TEST was migrated from PostgreSQL 17.5/PostGIS 3.5.2 to **18.6/3.6.4** using
the same pinned image as local DEV/TEST. The application database, both historical
snapshot databases, and `postgres` were restored into the separate destination
volume after an isolated rehearsal. Source templates contained no application
tables. All restored spatial databases also have topology and Tiger geocoder
extensions at 3.6.4. Database collation versions match the installed libc version.

Final backups were taken with API/web stopped. Application-table fingerprints,
stored geometries, extension configuration rows, sequence values/`is_called`,
large objects, roles/passwords, ownership, grants and database/role settings
matched. All 705 hosted media files matched their manifests. Planner statistics were
refreshed in every restored database. The temporary restore database was removed.
The original PostgreSQL 17 volume, validated archives, media snapshot, settings,
verification manifests and prior Compose definition were retained. A private
copy of database archives and recovery metadata was also retained off-host.

Spatial validation retained 795 findings and 135 pre-existing unreviewed errors;
issue identities and effective severities matched. Area text changed in 23
findings by at most 0.000006 square meters. Stored geometry was unchanged. The
comparison excluded extension-internal index naming changes, while retaining
application-index metadata checks and extension configuration-data checks.

TEST health returned after 229 seconds of maintenance, with the previous
application build unchanged. API/web restarted with existing Auth0 and restricted
database credentials; API restart count was zero, anonymous private access was
rejected, and the public access-request page returned HTTPS 200. The tunnel was
not restarted. Interactive Auth0 sign-in and authenticated saves remain user smoke
checks; no SQL optimizations were applied during this database upgrade.

### Regenerated SQL priorities on PostgreSQL 18.6/PostGIS 3.6.4

Read-only repository measurements against the hosted restored database used the
restricted API role, five measured repetitions after a warmup, and
`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)`. Alternating original/candidate runs
verified result equality. These exclude HTTP, authentication, browser rendering
and network latency; they are not a hardware-controlled comparison with PostgreSQL
17 or with local DEV/TEST. Some initial measurements overlapped verification
work; final live checks confirmed the principal slow paths after cutover.

| Priority | Work | Evidence and intended gain |
| --- | --- | --- |
| 1 | Refactor NHG review candidate matching | Approximately 15 seconds hosted. Repeated entry/burial/monument matching dominates. Compute candidate relations in sets and share matching work for counts and detail, preserving source-page evidence, unknown-name handling, scoring and cemetery scope. JIT off alone still takes about 12 seconds. |
| 2 | Transaction-local JIT control for interactive reports | Marker burial pages measured 5,239 → 579 ms with identical SQL results, about 89% lower latency. Unowned gravesites measured 653 → 349 ms; missing NHG links 1,259 → 1,001 ms. Use a connection-owned read-only transaction; preserve cleanup and pooled-connection isolation. |
| 3 | Group report relationships/evidence once | Missing NHG links still takes about one second without JIT. Replace repeated per-monument/per-grave relationship scans with grouped joins; resolve marker/grave source-entry IDs before OCR aggregation, deduplicate shared evidence and retain ordering and summary totals. Structural rewrite gains remain unmeasured. |
| 4 | Scope-aware search optimization and matching index expressions | Filtering matching ownership names/dates once improved representative ordinary text searches by about 15–20%; broad `a` improved about 6%. Reader/no-ownership and narrow cemetery cases showed little benefit or small regressions. Keep those fast paths; retain the complete rights relation for status derivation and all visibility checks. Align accent-normalized expressions with indexes before adding search indexes. |
| 5 | Avoid unnecessary account and inspection writes | Skip activity UPSERTs while the timestamp is fresh; keep authorization reads current and retain the conditional UPSERT for races. Avoid unchanged role updates, membership delete/reinsert, and unchanged inspection refresh/upsert writes. Preserve manual edits and auditing. Scaling benefit is not yet measured. |
| 6 | Prepare multi-cemetery reads and imports for growth | Batch stable lookups (currently 23 queries), paginate/filter entity selectors and the account directory, push cemetery scope early, group lookup usage counts, and stage larger imports for set-based promotion. Current small data does not establish a large latency gain. |
| 7 | Selective index cleanup | Five nonunique indexes duplicate retained unique indexes, totaling 232 KiB locally. Check dependencies and remove only redundant nonunique indexes through a new migration. Evaluate audit `occurred_at/id` ordering and text-expression indexes using actual workload evidence. |
| 8 | Query observability and evidence-led tuning | Enable `pg_stat_statements` during planned maintenance with restricted diagnostic access. Measure real query frequency/total cost and application p95 before global JIT, memory, parallelism, partitioning or additional index changes. PostgreSQL 18 worker AIO is already active. |

Private detailed plans, parameter values, timings, result comparisons and recovery
records are retained in protected diagnostic/backup locations rather than Git.

### SQL efficiency implementation, 2026-11-05

The eight priorities above are implemented in the working application and
migrations 511–512. **Deployed to local DEV and hosted TEST on 2026-11-05**
from merged revision `ee0df929f92e8c50ff4c28078fb730278ea0d022` (PR #787).
Local TEST is also migrated through 512. The completed PostgreSQL upgrade is
separate. See
[ADR 0196](adr/0196-measured-sql-efficiency.md) for implementation decisions.

NHG candidates now share set-based surname, page and unknown-marker matches.
Reports aggregate relationships and evidence once, with transaction-local JIT
disabled for the three measured report paths. Search shares ownership matching
only on the broad ownership-enabled path. Account, membership and inspection
updates avoid unchanged writes while authorization remains current.

The SPA's reference lookup uses one database query and loads record choices via
scoped search/paging; the legacy full lookup remains available. Account listings
have server-side filters and paging. Lookup usage counts are grouped once. GeoJSON,
deed and NHG staging inserts use bounded parameterized batches inside the existing
transactions; domain promotion rules remain intact. No permission cache was added.

Five repetitions after warmup, alternating baseline/new repository calls against
an isolated local TEST clone, produced these representative medians:

| Workload | Baseline | Implemented |
| --- | ---: | ---: |
| NHG review | 3,317 ms | 199 ms |
| Marker burial pages | 1,109 ms | 27 ms |
| Missing NHG links | 258 ms | 14 ms |
| Unowned gravesites | 142 ms | 15 ms |
| Legacy full lookup | 14.38 ms / 23 queries | 9.86 ms / 3 queries |
| SPA reference-only lookup | — | 2.83 ms / 1 query |

These are repository timings, excluding HTTP and browser rendering. Small-fixture
lookup administration (8.76 → 10.38 ms) and directory listing (0.625 → 0.744 ms)
did not improve; grouping and bounded reads target growth rather than a measured
latency win on that dataset. Thirteen search cases retained their results.

Separate SELECT-only checks against hosted TEST compared current code with the
new NHG queries: default review 12.80 → 0.85 seconds, unknown-name review
30.09 → 0.46 seconds, and a 250-entry page 16.37 → 1.77 seconds. Entries,
summaries, candidate membership and first-five/additional-candidate processing
matched. Comparisons disregard order only within candidate arrays whose old
score/name ties were unspecified; the new final UUID tie breaker is deterministic.
These checks changed no hosted code, data or persistent settings. Timings vary
with workload, cache state and hardware.

Migration 511 removes only five redundant nonunique indexes, retains unique
constraints, adds matching normalized search/email indexes, and guards inspection
refresh functions. Migration 512 installs private query diagnostics. Both forward
and rollback/reapplication paths were rehearsed on the clone; spatial records and
marker data remained unchanged. Existing geometry review findings are unaffected.

#### Completed deployment verification

Both local databases and hosted TEST applied 511–512 after backups and now preload
query monitoring on the retained PostgreSQL 18 volumes. A fresh hosted restore
passed update, rollback and reapplication with unchanged application table
fingerprints. The live migrations also preserved those fingerprints. Runtime
API access to diagnostics is denied in all three databases.

PR and merged-revision CI passed, including database/Docker startup and all browser
shards; an independent full local browser run passed 296 tests. The deployed hosted
API/web passed candidate startup, source integrity, Auth0/runtime preservation,
account/media preservation, public HTTPS and private API checks, with zero API
restarts. Read-only smoke checks using the deployed runtime role exercised
references, both selectors, NHG review, all three optimized reports and search;
JIT returned to its prior setting and diagnostic access remained denied. The
hosted NHG default review smoke took 862 ms. No spatial corrections were applied.

#### Rollout and monitoring

Use the normal reviewed release procedure with a fresh backup and migration
rehearsal. Apply 511–512 and configure API-role grants before application cutover.
The Compose database command now includes `shared_preload_libraries=pg_stat_statements`
and `compute_query_id=auto`; a planned database restart/recreation is required to
activate it. Verify the pinned PostgreSQL image and existing volume selection
before restarting. Do not treat an application-only restart as sufficient.
Verify readiness, diagnostics permissions, API health and the new UI after release.

For local owner/DBA diagnostics after that rollout:

```bash
npm run db:query-stats -- --env dev
npm run db:query-stats -- --env test --limit 20
```

The CLI reads statements for `cemetery_api` in the current database and reports
query IDs, calls, total/mean execution time and buffer/temp-block counters. It
does not reset statistics. Query text is omitted unless explicitly requested with
`--include-query-text`; keep such output private. The diagnostics schema, views
and functions are unavailable to the runtime API role. Aggregate database means
do not measure HTTP p95; gather request latency separately before further tuning.

## Planner statistics and query benchmarks

After a logical restore, refresh planner statistics and measure the application's
repository queries using the runtime API role:

```bash
npm run db:benchmark -- --env dev --refresh-statistics
npm run db:benchmark -- --env test --refresh-statistics
```

The explicit refresh flag runs `ANALYZE` as the configured database administrator.
All benchmark queries use read-only sessions. The tool supports local DEV and TEST
only and records warm-cache map, grave/headstone detail, exact/broad/no-match
search, inventory report and spatial-validation timings before and after refresh.
The default is nine measured repetitions after two warmups. Use `--runs 5` to
shorten a run. Query plans include `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)`.
Timings include repository result mapping and database round trips, and exclude
HTTP, authentication and browser rendering. They are observations, not performance
thresholds; local CPU contention and cache state affect them.

Private results are written to a unique directory under
`db/backups/query-benchmarks/`. Plans can contain private parameter values. Spatial
record fingerprints are compared before and after the operation. Concurrent
application edits can cause that check to fail; investigate rather than overwrite
the new records.

Use `--jit-off` for a session-only comparison of JIT compilation costs. It changes
neither the running API nor database defaults. The local PostgreSQL 18 benchmark
found broad searches dominated by JIT compilation, so inspect that plan detail
before choosing a narrowly scoped application optimization.

### Local benchmark observations, 2026-10-30

These are measurements from the restored local PostgreSQL 18.6/PostGIS 3.6.4
application databases, not hosted TEST or production. `ANALYZE` reduced populated
tables with no recorded manual/automatic analysis from 50 to zero in DEV and
53 to zero in TEST. Spatial record fingerprints were unchanged.

The table shows rounded median repository-call times in milliseconds. DEV used
nine measured repetitions and TEST five, each after two warmups. Separate
post-refresh `--jit-off` runs used five repetitions per environment. Timings
exclude HTTP, authentication and browser work. Cache state, local CPU contention
and different run lengths limit direct comparisons.

| Workload | DEV before → after ANALYZE | TEST before → after ANALYZE | DEV / TEST with JIT off |
| --- | ---: | ---: | ---: |
| Map | 10.4 → 11.1 | 10.3 → 11.3 | 13.0 / 9.8 |
| Grave details | 8.4 → 7.2 | 7.9 → 7.1 | 7.2 / 7.5 |
| Headstone details | 5.8 → 5.5 | 6.6 → 5.5 | 5.5 / 5.5 |
| Exact grave search | 50.5 → 165.1 | 39.9 → 40.9 | 50.5 / 38.4 |
| Broad search (`a`) | 2177.4 → 2291.8 | 2240.1 → 2226.4 | 64.5 / 48.1 |
| No-match search | 49.7 → 187.1 | 39.3 → 39.1 | 52.7 / 38.9 |
| Spatial inventory | 4.1 → 5.0 | 4.0 → 4.3 | 4.0 / 4.3 |
| Available inventory | 6.0 → 6.8 | 28.3 → 4.5 | 5.9 / 4.8 |
| Spatial validation | 33.8 → 35.6 | 28.7 → 28.3 | 34.8 / 29.1 |

`EXPLAIN` showed broad-search execution dominated by JIT compilation. In DEV,
updated estimates also crossed the JIT threshold for exact/no-match searches,
accounting for their regression. Accurate statistics do not guarantee lower
latency for every query. The JIT-off comparison affected benchmark sessions only;
no API configuration, role defaults or database-wide JIT settings were changed.
Any application optimization remains a separate measured change. Full plans and
parameters remain in ignored local backups; this table contains no private records.

### Search-specific JIT fix

Application search now uses a checked-out connection and a read-only transaction
with `SET LOCAL jit = off` before planning the search SELECT. Commit or rollback
restores the connection's prior setting; a connection whose rollback fails is
discarded. Database-wide, role and general API pool settings remain unchanged.
Unrelated requests and reports retain their existing JIT policy. See [ADR 0195](adr/0195-search-transaction-local-jit.md).

The benchmark command measures this request-facing behavior by default. To compare
it with the unchanged SELECT under the session's normal JIT policy, run:

```bash
npm run db:benchmark -- --env dev --runs 5 --baseline-search
npm run db:benchmark -- --env dev --runs 5
```

Repeat with `--env test`. The baseline flag is diagnostic only and does not change
the running API. Search plans are captured under the same policy as the timed
queries. `--jit-off` still disables JIT for the entire benchmark session when a
broader diagnostic comparison is needed; it is not required for the search fix.

### Scoped search benchmark observations, 2026-10-30

With statistics already refreshed, the unchanged SELECT baseline and the scoped
search transaction were measured sequentially using five repetitions after two
warmups per environment. Rounded medians are milliseconds and include connection
checkout, transaction round trips and repository mapping; they exclude HTTP and
browser work. Neither trial used the session-wide `--jit-off` flag.

| Workload | DEV baseline → scoped search | TEST baseline → scoped search |
| --- | ---: | ---: |
| Exact grave search | 173.0 → 51.8 | 38.7 → 39.9 |
| Broad search (`a`) | 2231.1 → 63.8 | 2192.5 → 49.5 |
| No-match search | 173.8 → 50.0 | 39.0 → 39.8 |

Scoped search EXPLAIN plans had no JIT compilation. New connections still reported
`jit=on`, and same-backend regressions verified restoration after success, SQL
errors and queued unrelated queries. Complete results matched the baseline across
ownership visibility, status filters, cemetery scope, pagination and SQL-like text.
Spatial record fingerprints were unchanged in both environments. Ordinary TEST
exact/no-match search did not trigger JIT in the baseline, so its small differences
reflect transaction overhead and local timing variation rather than a speedup.
Detailed plans and parameters remain private in ignored backups.

## Reversible spatial repair previews

The preview tool generates candidates and a local comparison viewer. It has no
apply command and never updates database geometry. It requires an explicit
cemetery UUID, section, table and appropriate WGS84 UTM SRID; tolerances are meters.
For example, use EPSG 32617 for the local Trinity data.

Build the isolated worker using only its small source directory as build context:

```bash
docker build --platform linux/amd64 -t cemetery-spatial-preview:geos314 scripts/spatial-preview
npm run db:preview:spatial-repair -- --env dev --table gravesites --cemetery CEMETERY_UUID --section C --srid 32617
```

Repeat with `--env test`, or use `--table lots` to preview lot boundaries. Find the
cemetery UUID in the application's map response or the `cemeteries` table. Deleted
records are excluded from candidate generation and remain untouched.

The worker calls GEOS 3.14+ coverage cleaning on projected polygon copies. It runs
without network, database credentials or mounted database volumes. This also
avoids a known image limitation: some PostGIS 3.6 binaries expose
`ST_CoverageClean` but were compiled against GEOS 3.13 and cannot execute it, even
when a newer runtime GEOS library is present. The worker records its image ID and
actual GEOS version for reproducibility.

Snapping and gap filling default to zero. Optional `--snap-meters` and
`--gap-meters` accept values up to 0.1 meters. **These tolerances do not cap boundary
movement caused by resolving overlaps.** The algorithm chooses overlap ownership
geometrically, without knowledge of surveyed boundaries, burials or deeds.
Originals, including every input UUID, are preserved even when a candidate
collapses to an empty geometry. Do not automatically apply the candidates.

Each unique, private `db/backups/spatial-preview/` directory contains:

- `preview.html`: an offline viewer with original/proposed overlays, fixed marker
  context, record selection and change metrics.
- `original.geojson` and `proposed.geojson`: separate review layers.
- `preview.json`: exact original and candidate EWKB, SHA-256 hashes, source
  fingerprints, projection/tolerance settings, algorithm version and per-record
  metrics. Exact original EWKB reconstruction is verified; GeoJSON is for review.

Review displacement, changed area, parent containment, empty/invalid outputs,
changes to non-estimated geometry and linked markers losing polygon coverage.
Overlap counts cover all selected polygon pairs with positive intersection area
above 0.00000001 square meters, including previously reviewed overlaps; they are
not the unreviewed validation-error count. Pairs outside the selected scope are
not assessed. A clean candidate coverage does not establish correct placement.
Preserve marker positions and approved boundaries. Any later application needs a
separate reviewed correction plan, a fresh source-hash check and retained originals.

Run the explicit read-only worker regression after building the image:

```bash
APP_ENV=dev node --test scripts/spatial-preview/coverage-worker.integration.mjs
```

### Local preview observations, 2026-10-30

Twelve review layers were generated: active graves in sections A–E in each local
environment, plus Section C lots in both. All source spatial record fingerprints
matched the pre-maintenance baseline. No proposed geometry was applied and no
marker was moved. The following Section C outcomes were the same in DEV and TEST:

| Layer | Input polygons | Changed candidates | Maximum Hausdorff distance | Linked marker coverage losses |
| --- | ---: | ---: | ---: | ---: |
| Lots | 111 | 1 | about 0.00000012 m | 0 |
| Graves | 361 | 212 | about 2.915 m | 38 |

The lot change was a numerical sliver (about 0.00000015 m²). Grave candidates
removed all 346 within-scope intersection pairs measured by the preview, including
previously reviewed overlaps, but displaced 147 records by more than 10 cm.
The 38 coverage losses mean fixed, linked markers that were covered by their
original grave polygon would be excluded by its candidate boundary. The marker
coordinates themselves are unchanged. A topologically clean coverage therefore
cannot be treated as an approved spatial correction.

The local validation baseline still has 158 unreviewed errors in DEV and 135 in
TEST. Generating preview files does not resolve those errors or approve an
exception. Review lot assignments, field evidence, fixed markers and existing
exceptions before proposing narrowly scoped corrections. Original EWKB, candidate
layers, detailed manifests and the local review dashboard remain private under
ignored backups. The CLI generates a per-run viewer; the aggregate dashboard was
assembled for this review and is not a separate maintained CLI feature.

## Recovery

Before reopening writes on 18, recovery is to stop the new database, restore the
pre-upgrade checkout with its PostgreSQL 17 image **and old mount path**, and remove
only the new-volume selection from the local override so Compose selects the
recorded old volume again. Never attach that old volume to an unreviewed command
or delete either volume during recovery. Verify the old application before
reopening it. Keep the new volume for diagnosis.

After writes resume on 18, the 17 volume is no longer current. Returning to it
would lose those later edits; use a reviewed reconciliation or forward-fix plan.
A PostgreSQL 18 dump must not be assumed compatible with PostgreSQL 17.

## PostGIS 3.7 rehearsal — 2026-11-14

PR #848 was refreshed against main `cc38a6c`. A private logical dump of local DEV
was restored into a uniquely named disposable PostgreSQL 18.6/PostGIS 3.6.4
cluster, then its disposable volume was reopened with the new compatibility image.
Explicit core and topology extension updates produced 3.7.0 with TIGER retained at
3.6.4. All 84 non-extension tables matched by ordered JSON row hashes (including
stored geometry), as did sequences and large objects. All 893 existing spatial
findings, including 675 errors, were identical; this upgrade does not resolve
those pre-existing data findings. Read-only map responses covering 3 cemeteries,
784 graves and 566 markers, plus C-0384 detail and marker responses, matched exactly.
Table fingerprints still matched after restarting the upgraded copy.

Private dump and verification evidence remain under ignored
`db/backups/postgis37-pr848-20261114T150253Z/`; no records or credentials are
committed. The disposable containers and volumes were removed. Maintained DEV,
local TEST and hosted TEST were not restarted or upgraded. The integration suite
also passed fresh startup, PostgreSQL 17 fail-closed/recovery and logical restore,
plus a 3.6 same-volume upgrade and fresh dump restore preserving TIGER user data.
