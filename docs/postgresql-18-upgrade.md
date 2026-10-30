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
