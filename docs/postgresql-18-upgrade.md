---
render_with_liquid: false
---

# PostgreSQL 18 volume layout and upgrades

[Documentation Home](index.md) · [Rebuild Guide](rebuild.md) · [ADR 0193](adr/0193-postgresql18-volume-layout.md)

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
   APP_ENV=dev npm run db:validate:spatial
   ```

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
