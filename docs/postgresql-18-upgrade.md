---
render_with_liquid: false
---

# PostgreSQL 18 volume layout and upgrades

[Documentation Home](index.md) · [Rebuild Guide](rebuild.md) · [ADR 0193](adr/0193-postgresql18-volume-layout.md) · [ADR 0194](adr/0194-local-database-review-tools.md)

The root `docker-compose.yml` now runs `postgis/postgis:18-3.6`. PostgreSQL 18
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

This change applies to root Compose environments (DEV/TEST/STAGE/PROD). The
separate hosted TEST stack in `deploy/test/compose.yaml` remains pinned to its
reviewed PostgreSQL 17 image and volume layout. This PR does not migrate or restart
that deployment. Historical ADR version tables describe their original decisions.

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
