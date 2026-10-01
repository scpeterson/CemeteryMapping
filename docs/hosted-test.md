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

As verified on September 29, 2026, hosted TEST has Auth0 account provisioning
enabled with a TEST-only Management API client scoped to `read:users` and
`create:users`. Its credentials and database connection are configured in the
host's protected `runtime.env`, along with `AUTH0_PASSWORD_RESET_CLIENT_ID` for
the hosted TEST SPA. Admin → Users can find or create an approved tester's
Auth0 identity when the Auth0 user ID is left blank. See
[Requesting and Approving Access](access-requests.md) for the full workflow.
Password-setup email configuration is enabled, but delivery has not yet been
verified with a real tester. Confirm receipt and successful password setup with
the first tester; finding an existing identity does not resend the invitation.

Public routing exceptions must be limited to `/request-access`,
`/request-access/`, `/assets/*`, and `/api/access-requests`. The submission endpoint
has an Nginx per-visitor limit and a second API process limit. The origin listens
only on loopback; the visitor header used by Nginx is supplied by Cloudflare.
Do not open `/api/*` or `/media/*` publicly. Hosted TEST implements these exceptions
with the **North Hills TEST public request resources** Access application and a
reusable Bypass policy; the original whole-host allowlist remains in place.
Because Access path destinations also match descendants, Nginx rejects unused
subpaths beneath the form and submission endpoint.

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

### Resolving the September 2026 Mashey prerequisite

The older hosted TEST snapshot stored Mary's surname as `Mashey/Gollmar` with an
empty maiden name. Her existing burial and marker link were present; migration
415 correctly refused to split the graves because it expected `Mashey` and
`Gollmar` in separate fields. The failed transaction changed no cemetery data.

Migration 417 normalizes only that known imported name, matching the approved DEV
record. The root changelog deliberately includes 417 **before** the unchanged 415
changeset. Already-split databases are left alone, and environments without the
Trinity source are skipped. Unexpected or conflicting records still stop with a
prerequisite error; do not mark 415 executed or bypass its assertions.

Back up TEST, rehearse the full changelog against a copy, then run the normal
root changelog update. Verify Mary in B-0103A north of Amos in B-0103, their fixed
shared marker, unchanged neighboring graves and personal dates, and unchanged
TEST users, assignments, requests, photos, and roles. Rerun API grants and confirm
Liquibase reports no pending changes. This targeted repair is not a DEV database
refresh and does not replace TEST identity mappings.

Completed on September 29, 2026 after merging
[PR #589](https://github.com/scpeterson/CemeteryMapping/pull/589): the full
changelog was rehearsed against an isolated copy, a fresh hosted backup was
taken, and migrations 417 and 415 were applied to TEST. Verification confirmed
Mary in B-0103A, Amos in B-0103, their shared marker links, and preservation of
TEST users, assignments, access requests, photos, and unrelated cemetery data.
API grants were reapplied, the API health check passed, and Liquibase reported
no pending changes at that verification. No DEV cemetery-data refresh was run.

## September 30, 2026 DEV data refresh

At the owner's request, hosted TEST cemetery data and media were replaced from a
consistent DEV snapshot, discarding TEST cemetery edits. The source revision was
`f95df46` (PR #598), with migrations 418–422 already applied in DEV. The restored
TEST database now includes those migration records and the final lot placements;
these migrations were not rerun over the restored snapshot.

This was a data/media refresh, not a code deployment. API/frontend release
metadata remains `d82e8e5`, built September 29. TEST Auth0 configuration, the
Cloudflare gateway, and protected runtime settings were retained.

Before cutover, a separate database was restored from `template0` using
`--no-owner --no-privileges`. TEST users, cemetery assignments, access requests,
audit history, system events, and retention settings were preserved. DEV identity
mappings were disabled before reinstating the exact TEST records; no DEV identity
was granted active TEST access. Every foreign key was checked explicitly after
preservation, and restricted API grants were refreshed. The media copy was staged
and checksum-compared before switching paths.

During a brief API/web stop, a final TEST backup and fresh access-record export
were taken. The databases and media directories were swapped, then API and web
containers were recreated to bind the refreshed media directory. The prior TEST
database and media remain available for rollback, alongside validated database
backups. Account-specific backup locations are recorded in the private operations
repository; they contain private data and must stay outside Git.

Verification on September 30 by Codex confirmed:

- Counts and full row-content hashes match DEV for all 70 domain tables checked.
- All 498 active media references resolve, and the API can read their files.
- Both active TEST users, the cemetery assignment, and both access requests were
  preserved exactly, including roles, active flags, identity subjects, and timestamps.
- The recent lots are present; TLC-HS-0138 and TLC-HS-0139 remain strictly inside B-1.
- Database health passes and the API remains in Auth0 mode using restricted credentials.
- The public request page returns 200; unauthenticated origin map access returns
  401 and Cloudflare redirects protected map requests to its access check.

No fresh interactive Auth0 sign-in or real invitation-email delivery was tested
in this refresh. Existing identity mappings and runtime settings were verified;
confirm those interactive workflows with an approved tester when available.
This one-time preservation/rehearsal procedure does not establish an automated
refresh workflow. Continue to follow the review and backup requirements above.
