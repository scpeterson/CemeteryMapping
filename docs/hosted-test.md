---
---

# Hosted TEST

The dedicated host is managed separately from local TEST. See
[ADR 0073](adr/0073-private-hosted-test.md).

## Availability and cost

The accepted setup keeps hosted TEST available independently of the developer's
Mac. No scheduled shutdown or automatic snapshot-and-recreate workflow is
currently configured.

DigitalOcean's bundled-plan CPU Droplets continue to incur compute charges when
powered off; billing ends when the Droplet is destroyed. Stopping Docker services
or scheduling a nightly shutdown therefore does not reduce those charges. See
[DigitalOcean's billing rules](https://docs.digitalocean.com/products/droplets/details/pricing/).

Two possible cost reductions remain options, not adopted operating procedures:

- For frequent testing, measure CPU, memory, and disk usage to assess whether a
  smaller continuously running Droplet can support the API and PostgreSQL/PostGIS.
- For long gaps between testing, retain a snapshot and destroy the Droplet, then
  create a replacement from that snapshot when testing resumes. Snapshot storage
  remains billable, as do any other retained paid resources. DigitalOcean lists
  Droplet snapshots at $0.06 per GB per month as of September 28, 2026; verify
  [current snapshot pricing](https://docs.digitalocean.com/products/snapshots/details/)
  before estimating savings. This requires a restore and verification period
  before testers can use the site again.

Before adopting snapshot-and-recreate, verify a restore procedure that preserves
the current TEST database, uploaded media, deployment settings, and credentials.
Keep a logical database backup and a separate copy of media outside the Droplet;
shut down cleanly before taking the final snapshot, and confirm that the snapshot
will be retained when deleting the server. Account for any separately attached
storage. On recreation, restore the Cloudflare Tunnel connection and verify
database health, Access protection, Auth0 login, map records, and photos using the
checks below. Update ADR 0073 and this runbook if the availability model or server
sizing changes.

## Deployment files

Place a selected source revision and a TEST frontend build in
`/srv/nhcemeteries/app`. Run Compose from `deploy/test` in that directory.
Create `.env` containing distinct, fresh `POSTGRES_PASSWORD` and
`CEMETERY_API_PASSWORD` secrets and `runtime.env` containing
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
required schema changeset exists, then run
`docker compose exec -T db sh /usr/local/bin/configure-api-role.sh`
before starting `docker compose up -d api web`.
For the initial restore, use an empty database created from `template0`; the
image’s preinstalled PostGIS/tiger objects can conflict with a complete dump.
The restore is only for initial deployment, never a routine code update.

### Upgrade an existing deployment to restricted API credentials

Back up first. Add a new, distinct `CEMETERY_API_PASSWORD` to the administrator-only
`.env` file. Run `docker compose up -d db` to load the new environment and mounted
role setup script (this preserves the database volume). Run the role setup command
above, then rebuild/recreate the API with `docker compose up -d --build api`.
The API now connects as `cemetery_api`; `cemetery_app` remains the administrative
account for migrations, restores, and backups. Never supply its password to the API.
Run the role setup script again after every migration or restore to grant access to
new application tables. It is repeatable and does not change application records.
No default grants are used, so newly created tables remain inaccessible until this
explicit step. Verify map reads, an authorized edit, photo access, and audit events
after switching credentials. Other hosted environments must use the same separation.

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
- An unauthenticated browser can load `/request-access` and its `/assets/*` files
  and POST `/api/access-requests`. All other application paths remain behind
  Cloudflare Access. Verify the approved email can sign in and another email cannot.
- Auth0 login must return to the TEST hostname and resolve to an active
  `app_users` record with the intended role.
- Check a map record and protected photo through the public hostname.
- Record `docker image inspect` repository digests with the release metadata.

Before updates, make a logical database backup and retain the current release
and matching media. Build a new release without altering persisted data. Apply
reviewed migrations deliberately, then check health and browser access. Code
rollback does not undo database migrations; use their reviewed rollback or
forward-fix procedure. Never use `docker compose down -v` on this host.

## Tester access and DEV data refreshes

Send potential testers `https://test.nhcemeteries.org/request-access`. A global
Admin reviews requests under **Admin → Users**. To permit Trinity editing, select
**Power user** and assign **Trinity Lutheran Church Cemetery** before saving.
The tester edits the hosted TEST copy, not DEV or the future production database.
Add the approved email to the existing Cloudflare Access allowlist as well;
application approval does not yet synchronize that list.

Public routing exceptions must be limited to `/request-access`,
`/request-access/`, `/assets/*`, and `/api/access-requests`. The submission endpoint
has an Nginx per-visitor limit and a second API process limit. The origin listens
only on loopback; the visitor header used by Nginx is supplied by Cloudflare.
Do not open `/api/*` or `/media/*` publicly.

A code deployment preserves TEST users, cemetery assignments, access requests,
and cemetery edits, except for changes explicitly made by reviewed migrations.
A DEV cemetery-data refresh is a separate, deliberate operation: replacement
cemetery records may overwrite tester edits. A full DEV database restore would
also overwrite TEST's `app_users`, `app_user_cemetery_access`, and `access_requests`.
Auth0 TEST identities live outside PostgreSQL and survive, but their application
access would be lost or replaced with incorrect DEV identity mappings.

There is not yet an automated refresh that preserves TEST identities. Before any
refresh, back up the complete TEST database and media, retain TEST-specific users,
roles, active flags, cemetery assignments, access requests and their audit history,
and verify cemetery IDs still match the assignments after replacement. Use a
reviewed data-only refresh or a tested preservation/restore procedure; do not run
a whole-database DEV restore as a routine release. Verify the same TEST accounts
can sign in with the same cemetery permissions before reopening the site.
