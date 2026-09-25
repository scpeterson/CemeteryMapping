---
---

# Hosted TEST

The dedicated host is managed separately from local TEST. See
[ADR 0073](adr/0073-private-hosted-test.md).

## Deployment files

Place a selected source revision and a TEST frontend build in
`/srv/nhcemeteries/app`. Run Compose from `deploy/test` in that directory.
Create `.env` containing a fresh `POSTGRES_PASSWORD` and `runtime.env` containing
`AUTH0_DOMAIN`, `AUTH0_AUDIENCE`, `GIT_SHA`, and `BUILD_TIME`. Restrict both files
to the host administrator. Optional Auth0 Management API credentials must be
scoped to the TEST tenant. Never copy a DEV database password to the host.

Keep the hosted SPA's `VITE_AUTH0_DOMAIN`, `VITE_AUTH0_CLIENT_ID`,
`VITE_AUTH0_AUDIENCE`, and `VITE_AUTH0_SCOPE` in ignored
`deploy/test/frontend.env`. Build in a subshell with
`(set -a; . deploy/test/frontend.env; set +a; npm run build:test)` so hosted
values override the local TEST SPA configuration in `.env.test.local` without
changing DEV. Add only `https://test.nhcemeteries.org` to the hosted TEST SPA's
allowed callback URLs, logout URLs, and web origins.
The API must use `AUTH_MODE=auth0`; Compose enforces this setting.

Use a dedicated TEST Auth0 tenant, never the DEV tenant. The hosted SPA uses
only its hosted origin. Local interactive TEST needs its own SPA client in the
TEST tenant with localhost callbacks; automated tests continue using their
explicit test authentication configuration. STAGE and PROD each require their
own tenant, audience, clients, users, credentials, database, and media storage
before deployment. Do not copy authentication settings between environments.

When switching identity tenants, back up the database and deployment settings,
disable inherited `app_users` mappings, then deploy the new frontend domain,
client ID, audience, and matching API issuer/audience together. Verify each new
TEST identity before linking its subject and reactivating approved access.
Existing DEV passwords and role assignments are not migrated automatically.

Create the database first with `docker compose up -d db`, restore an approved
custom-format dump using `pg_restore --no-owner --no-privileges`, and copy the
matching media to `/srv/nhcemeteries/media` (owned by UID 1000). Ensure the
required schema changeset exists before starting `docker compose up -d api web`.
For the initial restore, use an empty database created from `template0`; the
image’s preinstalled PostGIS/tiger objects can conflict with a complete dump.
The restore is only for initial deployment, never a routine code update.

Configure the Cloudflare tunnel route to `http://127.0.0.1:8080`, with a final
404 catch-all. Protect the entire hostname with Access before adding its DNS
route. Store the connector token in ignored `tunnel-token`; make it readable
only by the cloudflared container user (UID/GID 65532, mode 0400), with
`/srv/nhcemeteries` restricted to the host administrator (mode 0700).
Start it with `docker compose --profile tunnel up -d tunnel`.

## Verification and updates

Install `deploy/test/backup.sh` as `/usr/local/sbin/nhcemeteries-test-backup`
and run it daily before the provider backup window. It creates a validated
custom-format database dump, keeps 14 days locally, and preserves the initial
snapshot. Provider backups cover this directory and media, but they are still
in the same provider account; a separate offsite copy remains follow-up work.

- `docker compose ps` must show healthy database and running application services.
- Check `http://127.0.0.1:8080/api/health` from the host and confirm TEST metadata.
- Direct external access to ports 5432, 3001, and 8080 must be blocked.
- An unauthenticated browser must encounter Cloudflare Access before application
  content. Verify the approved email can sign in and another email cannot.
- Auth0 login must return to the TEST hostname and resolve to an active
  `app_users` record with the intended role.
- Check a map record and protected photo through the public hostname.
- Record `docker image inspect` repository digests with the release metadata.

Before updates, make a logical database backup and retain the current release
and matching media. Build a new release without altering persisted data. Apply
reviewed migrations deliberately, then check health and browser access. Code
rollback does not undo database migrations; use their reviewed rollback or
forward-fix procedure. Never use `docker compose down -v` on this host.
