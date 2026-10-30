---
---

# ADR 0194: Keep local database benchmarks explicit and spatial repair previews read-only

- Status: Accepted
- Date: 2026-10-30
- Owners: Project maintainers
- Related changes: [PR #768](https://github.com/scpeterson/CemeteryMapping/pull/768), [ADR 0193](0193-postgresql18-volume-layout.md)

## Context

The local DEV/TEST upgrade to PostgreSQL 18.6 and PostGIS 3.6.4 preserved stored
records but required renewed planner statistics and measurements of real
application queries. Spatial validation also retains pre-existing issues involving
estimated polygons and lot assignments. Automatically cleaning overlapping
polygons cannot determine correct placement from field evidence, ownership or
fixed markers.

The local PostGIS binary exposes `ST_CoverageClean` but was compiled against
GEOS 3.13.1. It cannot execute coverage cleaning even though the runtime library
is GEOS 3.14.1. Replacing the live extension solely to preview candidates would
unnecessarily couple spatial investigation to a database binary change.

## Decision

Provide local-only DEV/TEST command-line tools with separate maintenance and
review boundaries:

- Benchmark actual map, detail, search, inventory and validation repository
  queries through read-only connections using the runtime API role. Only the
  explicit `--refresh-statistics` flag runs `ANALYZE` with administrator credentials.
- Record warm-cache samples and parameterized query plans privately. Permit
  `--jit-off` only as a benchmark-session setting; do not change application or
  database-wide settings implicitly.
- Read preview sources in a repeatable-read, read-only transaction. Require an
  explicit cemetery, section, polygon table and appropriate WGS84 UTM zone so
  tolerances and metrics use meters.
- Run GEOS 3.14+ coverage cleaning on projected copies in a separate Docker worker,
  without network access, database credentials or mounted database volumes.
  Retain its actual GEOS version and image ID in each preview manifest.
- Keep exact original EWKB, UUIDs, SHA-256 hashes, separate candidate layers and
  review metrics. Verify exact original reconstruction and compare source spatial
  fingerprints, including a fresh snapshot to detect concurrent edits.
- Include displacement, invalid/empty candidates, non-estimated geometry changes,
  parent containment and linked marker coverage losses in the review output.
  Preserve every source record, including when its candidate collapses.
- Supply an offline viewer with overlays and record inspection. Provide no apply
  command. A future correction requires its own reviewed plan and fresh source
  checks; original database geometry remains unchanged during preview generation.

## Rationale

Actual repository workloads make performance observations useful to application
maintainers. Explicit statistics maintenance avoids surprising writes during a
benchmark. Separate original/candidate artifacts permit comparison and discarding
proposals without requiring database rollback. The offline worker uses the new
GEOS algorithm without changing the live PostGIS build.

Alternatives considered were running cleanup directly on live records, replacing
the live extension before review, and accepting all intersections as reviewed
exceptions. None establishes the correct physical or documentary placement.
The chosen workflow keeps performance measurement and geometric proposals
independent of approval to alter data.

## Consequences

Local benchmark results are workload observations, not performance guarantees.
Statistics refresh can change plans and increase JIT overhead for some queries.
Any session-setting or query optimization must be measured separately.

Preview tolerances do not cap movement caused by overlap resolution. A candidate
can be valid and overlap-free while excluding a fixed marker or moving an approved
boundary. The current tool does not assess pairs outside the selected scope.
Manual review remains necessary. Detailed plans and spatial artifacts can contain
private data and stay under ignored, restricted-permission backup directories.

The worker image adds an explicit Docker build dependency. The initial worker
uses `postgis/postgis:18-3.6` plus Python 3 and calls the GEOS C API directly.
The tag can change; each generated manifest records the resolved worker image ID
and GEOS version. Retain that image with the review artifacts when reproducibility
is required. The separately hosted TEST PostgreSQL 17 stack is outside this tool's
operational scope.

## Rebuild Notes

Start and migrate a local DEV or TEST database and configure its restricted API
role through the existing setup workflow. Existing PostgreSQL 17 data must first
follow the [upgrade guide](../postgresql-18-upgrade.md).

```bash
npm run db:benchmark -- --env dev --refresh-statistics
npm run db:benchmark -- --env dev --runs 5 --jit-off
docker build --platform linux/amd64 -t cemetery-spatial-preview:geos314 scripts/spatial-preview
npm run db:preview:spatial-repair -- --env dev --table gravesites --cemetery CEMETERY_UUID --section C --srid 32617
node --test scripts/spatial-repair-preview.test.mjs
APP_ENV=dev node --test scripts/spatial-preview/coverage-worker.integration.mjs
```

Replace `CEMETERY_UUID` and select the section's correct UTM zone; EPSG 32617 is
appropriate for the local Trinity data. Use `--env test` for local TEST. Existing
administrator and runtime API credentials come from ignored environment files;
never copy them into review artifacts or documentation. The worker regression
uses synthetic geometries in read-only queries and is an explicit opt-in after
the image build. Routine server tests cover preview option validation, risk
summaries and inert embedding of record labels in the viewer.

See the guide for [benchmark methodology and results](../postgresql-18-upgrade.md#planner-statistics-and-query-benchmarks)
and [preview limits and observations](../postgresql-18-upgrade.md#reversible-spatial-repair-previews).

## Update Triggers

Update or supersede this ADR when enabling hosted operation, adding an apply
workflow, changing geometry provenance or approval policy, switching the worker
algorithm, adopting a different projection policy, or changing benchmark-session
settings in the running application.
