---
---

# Hosted TEST

The dedicated host is managed separately from local TEST. See
[ADR 0073](adr/0073-private-hosted-test.md).

The latest database maintenance is the **November 5, 2026 PostgreSQL 18.6 /
PostGIS 3.6.4 cluster upgrade**, recorded in the
[upgrade guide](postgresql-18-upgrade.md#hosted-test-validation-record-2026-11-05).
The latest recorded code deployment is [v0.2.4 on November 10](#november-10-2026-nhg-suggestion-priority-release)
at `8806506`. Dated sections
below describe historical releases and their verification scope. Check
`/api/health` for the running application release.

The latest edge-security change is the
[November 9 Cloudflare burst protection](#november-9-2026-cloudflare-burst-protection)
for the public access-request API.

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
Include the `shared/` source directory in the release archive alongside `server/`.
The API imports shared normalization modules at runtime; the Dockerfile and its
allowlist in `deploy/test/Dockerfile.dockerignore` must both include `shared/`.
Missing shared modules can prevent the API from starting.

Create `.env` containing distinct, fresh `POSTGRES_PASSWORD` and
`CEMETERY_API_PASSWORD` secrets and `runtime.env` containing
`AUTH0_DOMAIN`, `AUTH0_AUDIENCE`, `GIT_SHA`, and `BUILD_TIME`. Restrict both files
to the host administrator. Optional Auth0 Management API credentials must be
scoped to the TEST tenant. Never copy a DEV database password to the host.

### GeoNames location search

Birth and death location searches require the backend's GeoNames configuration.
Add this setting to the host's protected `deploy/test/runtime.env`:

```env
GEONAMES_USERNAME=cemetery_app_geoname
```

The account must have its email confirmed and **Free Web Services** enabled on
the [GeoNames account page](https://www.geonames.org/manageaccount). Registration
alone is insufficient. See [account setup and troubleshooting](https://github.com/scpeterson/CemeteryMapping/blob/main/README.md#birth-and-death-location-setup-geonames).

After editing the file, run the following from the host's `deploy/test` directory
to load the changed container environment:

```bash
docker compose up -d --no-deps --force-recreate api
```

A plain container restart does not load changes to `runtime.env`. No frontend
rebuild is needed. Ensure outbound HTTPS to `secure.geonames.org` is available,
then verify a `Pittsburgh` search in the burial editor with a power-user or admin
account. Select a result and save the burial to verify the complete workflow.

### Hosted frontend configuration

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

## Updating the cloudflared connector

The `nhcemeteries-test` connector runs in Docker on the TEST host. Updating a
Mac installation does not update this container. Docker updates require pulling
and recreating the container, as described in
[Cloudflare's update guide](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/update-cloudflared/).
The Compose file pins cloudflared 2026.10.3 by digest for the
[eMudhra certificate security update](https://blog.cloudflare.com/emudhra-certificate-compromise/).

For future upgrades, review and update the pinned image first. On the TEST host,
from `/srv/nhcemeteries/app/deploy/test`, start a temporary replica with the new
image and the existing token file. Keep the token owned by UID/GID 65532 with
mode 0400, including when copying it during application releases. Do not print
the token or put it in arguments:

```sh
docker compose --profile tunnel pull tunnel
docker run -d --name nhcemeteries-test-tunnel-upgrade --restart unless-stopped \
  --network host -v "$PWD/tunnel-token:/run/secrets/tunnel-token:ro" \
  cloudflare/cloudflared:2026.10.3@sha256:faa8e0a1475f137c910be6025f43c8e4092fdd35461b31e19fd1390657a1ff39 \
  tunnel --no-autoupdate --metrics 127.0.0.1:20246 run \
  --token-file /run/secrets/tunnel-token
curl -fsS http://127.0.0.1:20246/ready
```

Wait for four ready connections before replacing the original connector. Both
replicas reach the same loopback origin and use the existing remotely managed
routes. With the temporary replica connected:

```sh
docker compose --profile tunnel up -d --no-deps --force-recreate tunnel
curl -fsS http://127.0.0.1:20241/ready
docker compose exec -T tunnel cloudflared --version
curl -fsS -o /dev/null https://test.nhcemeteries.org/request-access
docker stop --time 40 nhcemeteries-test-tunnel-upgrade
docker rm nhcemeteries-test-tunnel-upgrade
curl -fsS http://127.0.0.1:20241/ready
```

Remove the temporary replica only after the new primary has four ready
connections and the public page succeeds. If the primary fails, keep the patched
replica running while correcting the primary. A replica on the same host covers
the connector restart; it does not provide host redundancy. Existing long-lived
connections may need to reconnect when their connector stops.

The primary metrics/readiness listener binds only to `127.0.0.1:20241`. Compose
allows 40 seconds for shutdown so cloudflared can use its 30-second grace period.
The current origin is `http://127.0.0.1:8080`, so it has no HTTPS origin certificate
to replace. If HTTPS origins are introduced, check their certificate chains
before trust-store upgrades and retain certificate verification. Application
code releases leave the tunnel service running; connector upgrades are separate.

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
forward-fix procedure. Changesets 461–472 have empty rollback actions and require
pre-migration backup recovery or a reviewed forward fix; Liquibase rollback alone
does not restore their data. Rehearse recovery on an isolated copy and account for
subsequent TEST edits before restoring a backup. See [rollback and backup recovery](https://github.com/scpeterson/CemeteryMapping/blob/main/db/README.md#rollback-and-backup-recovery).
Never use `docker compose down -v` on this host.

## Tester access and DEV data refreshes

Send potential testers `https://test.nhcemeteries.org/request-access`. A global
Admin reviews requests under **Admin → Users**. To permit Trinity editing, select
**Power user** and assign **Trinity Lutheran Church Cemetery** before saving.
Read-only testers also require a cemetery assignment. Every non-admin account
requires an assignment on creation and update; system admins remain exempt.
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

This was a data/media refresh, not a code deployment. At that refresh, API/frontend
release metadata remained `d82e8e5`, built September 29. The October 10 security
deployment below supersedes that code-release status. TEST Auth0 configuration, the
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

## Access-request abuse protection

Use [ADR 0088](adr/0088-access-request-abuse-protection.md) and the
[access-request guide](access-requests.md) for the verification contract and limits.
Migration 438 adds only the creation-time index on `access_requests`. It creates
no new table, so existing API table grants continue to apply.

Keep `TURNSTILE_SECRET` and `TURNSTILE_HOSTNAMES=test.nhcemeteries.org` in the
existing protected `deploy/test/runtime.env` (mode 0600). Store the public
`VITE_TURNSTILE_SITE_KEY` and `VITE_TURNSTILE_REQUIRED=true`, together with the
existing TEST Auth0 frontend settings, in ignored `deploy/test/frontend.env`.
Never substitute the public site key for the private secret. A dummy-token
Siteverify probe reporting `invalid-input-response`, without `invalid-input-secret`,
validates the secret; it does not validate the full form flow. Keep secrets out of
command arguments, output, source archives, and issue reports.

Build the frontend from those settings. Preserve database, media, Auth0 settings,
tunnel credentials, and gateway policies. Keep the loopback listeners and
`ACCESS_REQUEST_TRUST_PROXY=loopback`; Nginx must overwrite the visitor header.
If a Content Security Policy is introduced, permit the widget's scripts/frames
from `https://challenges.cloudflare.com` and test it before release.

### Repeatable deployment command

From the repository checkout, run:

```sh
umask 022
npm run deploy:test
```

For a named release, select its immutable tag or full 40-character commit SHA:

```sh
umask 022
npm run deploy:test -- --ref v0.2.0 --prepare-only
npm run deploy:test -- --ref v0.2.0
```

The example tag is usable only after its release is published. `--prepare-only`
performs backups and candidate validation without switching live services. The
subsequent deployment rebuilds and validates the same selected source revision;
it is not promotion of the previously built image. Each build has its own time.
The fetched reference must belong to `origin/main`; version tags must match
their package version. Branch names, abbreviated SHAs and arbitrary Git revision
expressions are rejected. CI must pass for the resolved commit, not a newer main
commit. Candidate and final health check the selected version/SHA/build identity.
Do not use an older tag as a database rollback: schema compatibility still needs
review, and the existing schema validation and recovery safeguards remain active.

Use the standard source-file creation mask so the release archive is readable by
the schema validator and candidate runtime. A restrictive inherited mask caused
the [November 9 pre-cutover failures](#november-9-2026-refactoring-and-draft-recovery-release).
The release workflow separately protects hosted settings and secrets; do not
broaden their permissions to fix source readability.

This is an on-demand release command for the existing hosted TEST host only.
It fetches `origin/main` and, when supplied, the explicit release reference,
requires the selected commit's **Lint, build, and test** check to have passed,
and builds that revision from a clean Git archive. Local
changes, personal media, ignored files and local environment settings are not
part of the release. It does not deploy a feature branch or configure a schedule.

Prerequisites: Node.js 24/npm, Git, authenticated GitHub CLI (`gh`), Python 3.11+,
OpenSSH, and the existing TEST SSH key at
`~/.ssh/nhcemeteries_test_ed25519`. Override the key path with
`HOSTED_TEST_SSH_KEY`; the TEST target and server paths are fixed in the command.
The host needs Python 3.11+, Docker/Compose, curl, and the established protected TEST
settings. No GitHub deployment secrets or changes to Cloudflare are required.

To validate preparation and candidate startup without restarting the live app:

```sh
npm run deploy:test -- --prepare-only
```

Both modes build the frontend using the existing hosted public settings, remove
all environment files from the source archive, verify archive/file hashes after
transfer, and take validated database and application backups. Media recovery
archives are shared through hard links only when their inventory matches and
the retained archive's checksum passes; changed media creates a new snapshot.
Concurrent host deployments are rejected by a lock. A pending migration stops
preparation before cutover: rehearse and apply schema changes using the existing
migration procedure, configure API grants, and rerun the command. This command
never restores, seeds, or migrates the live database.

The API is rebuilt without cache from the committed Dockerfile. A separate
candidate runs its default Node user/command with the existing Auth0 and
restricted database configuration. Checks require ownership/readability of the
mode-0600 environment file and a database-backed TEST health response matching
the selected commit and build time. Candidate failures leave live services alone.

After preparation, the command briefly stops API/web, takes a final database
backup, and checks that media has not changed since its backup. It swaps source
folders while preserving host environment files and the tunnel token (including
UID/GID ownership and modes), recreates
API/web, validates Nginx,
checks release/runtime hashes and account/media preservation, checks anonymous
private-API denial and the public page over local HTTP and hosted HTTPS, and
requires healthy API metadata with zero restarts. Database and tunnel services
remain running. Failed cutover or verification restores the previous application,
settings, and image, then checks the old release's health. Database/media writes
are retained; no database rollback is performed. A failed rollback exits with an
error and retains the recovery materials for operator recovery.

The command prints the release's protected staging and backup paths beneath
`/srv/nhcemeteries/{staging,backups}/`. Read `commands.log`, `candidate.log` on
failure, `preparation.json` after a successful rehearsal, `verification.json`
after deployment, or `rollback.json` after recovery in the
staging folder. Prepare-only mode removes temporary environment files after the
candidate check and requires a fresh command run for deployment. Recovery images,
backups, media snapshots and staging files are retained; review disk usage and
remove obsolete releases explicitly rather than pruning recovery data during a
release. Keep a separate offsite backup as described above.

### Safe release procedure

The command above implements the routine code release steps below. Retain these
steps for rehearsed schema changes and manual recovery.

1. Record the selected source revision, frontend build, image digests, and migration
   scope. Back up the existing database and application/settings. Rehearse the
   selected changelog on an isolated database copy before changing live TEST.
2. Build and fully transfer the release archive before extracting it. Compare
   source/frontend hashes against the completed local release. Do not start
   deployment while the transfer is still running.
3. Preserve protected env files when overlaying source. The Dockerfile uses
   `COPY --chown=node:node server ./server` so private source directory modes do
   not prevent `USER node` from reading routes. Do not solve container read errors
   by making the host's server/database/secret trees broadly readable.
4. Build the API image and verify that the runtime user can import the shared
   module before recreating the service:

   ```sh
   docker compose run --rm --no-deps api node --input-type=module -e "await import('./shared/recordNormalization.mjs'); const {readFileSync} = await import('node:fs'); readFileSync('./db/env/test.env');"
   ```

   The Dockerfile assigns the copied `db/env/test.env` file to the Node runtime
   user, so a source file with mode 0600 remains readable inside the image.
   Preserve the host file's restricted permissions; this ownership change applies
   only to the image. The read check above must not print the file contents.

   CI also runs `npm run test:docker-startup` after migrations and restricted API
   account setup. To repeat locally, start/migrate TEST and run
   `APP_ENV=test npm run db:configure-api` first. The check builds the committed
   Dockerfile in an isolated context with a synthetic mode-0600 env file, verifies
   Node ownership and readability, and checks `/api/health` against the TEST
   database. Credentials stay in a separate private runtime file; no host port
   is published. Temporary containers, image tags, and files are cleaned up.

   A missing-module or permission error must be corrected in the release archive,
   build allowlist, or image ownership before proceeding. Apply only the reviewed,
   rehearsed migration scope.
   Make generated public `dist` directories traversable and files readable by
   Nginx (directories 0755, files 0644); this does not apply to protected settings.
5. Recreate the API after runtime settings change. If `dist` was replaced by a
   directory rename, force-recreate web to bind the new directory:

   ```sh
   cd /srv/nhcemeteries/app/deploy/test
   docker compose up -d --no-deps api
   docker compose up -d --no-deps --force-recreate web
   docker compose exec -T web nginx -t
   ```

   If changing only the mounted Nginx configuration, validate it and reload Nginx
   explicitly; `compose up` can leave an existing web container running with its
   old worker configuration. Keep database and tunnel services running.
6. Confirm healthy TEST metadata, the actual public form/assets, missing/forged
   token rejection without stored rows, anonymous private/admin endpoint denial,
   and a small controlled burst returning 429. Submit a synthetic request with a
   real token, verify replay rejection using a client that keeps tokens private,
   and reject the synthetic request without provisioning an account.
7. Record results and gaps. Remove disposable rehearsal databases and temporary
   credential files after verification; retain protected recovery backups.

### Operating and troubleshooting

- Check **Admin → Users → Access requests** and review pending requests. The queue
  warns at 80% of the 100-per-hour or 200-pending ceilings. Reviewed requests remain
  historical; rejecting one frees pending capacity, not the rolling-hour count.
- Watch Cloudflare rate-limit events, Nginx 429 counts and Turnstile Analytics.
  The [edge burst rule](#november-9-2026-cloudflare-burst-protection) supplements
  the origin controls. API visitor/global rate buckets
  reset on process restart; database capacity limits survive restart. Do not
  restart services to evade limits or create a database log/email per rejection.
- A 403 verification failure can mean a missing/expired/invalid token, wrong secret,
  action/hostname mismatch, or failed outbound Siteverify call. Check configuration
  and connectivity without logging secrets or tokens; preserve fail-closed behavior.
- A 429 can originate at Cloudflare, Nginx, the API attempt limiter, database lock contention,
  or queue/hourly capacity. Honor Retry-After when supplied. Nginx 429 responses
  currently lack that header. Investigate before increasing limits.
- For a 502 after release, inspect API startup and source ownership. For a blank
  public page, check asset hashes, browser errors, readable public assets, and the
  web container's directory mount before changing authentication or gateway rules.
- Prefer a forward fix that keeps verification enabled. Rolling back to a release
  before protection removes verification/capacity controls; if unavoidable,
  temporarily close public submission until a protected release is restored.
  Code rollback does not undo migration 438; the additive index can remain with
  older code. Do not restore a database over later TEST edits as routine rollback.

## October 10, 2026 security deployment

Recorded by Codex from the completed deployment and checks on October 10.
[PR #637](https://github.com/scpeterson/CemeteryMapping/pull/637) added protection
to main. A full current-main rehearsal stopped at the unrelated migration 428
Pfeiffer burial prerequisite; the running database was not changed by that failed
rehearsal. Do not bypass that assertion or mark the migration executed.

The reviewed security-only release in
[PR #638](https://github.com/scpeterson/CemeteryMapping/pull/638) backported the
protection onto the deployed `d82e8e5` code. Its merged source/build identifier is
`21d4e3c55462f443f27ff44437970e978551daa8`. The maintenance branch is
`codex/hosted-test-release`; its selected root adds migration 438 without bringing
in migrations 423–437. This is a reviewed backport, not an instruction to edit the
main changelog or skip failed data migrations in future releases.

Migration 438 was rehearsed and applied. Existing cemetery data, media, TEST
identities, and existing requests were retained. Full main/backport CI passed.
The container source-ownership fix is merged into the hosted branch in
[PR #639](https://github.com/scpeterson/CemeteryMapping/pull/639)
(`295c9b310071c990a12cdeff5a77de2a5ace19de`) and into main in
[PR #640](https://github.com/scpeterson/CemeteryMapping/pull/640). The host includes
that Dockerfile fix; observed API/frontend security build metadata remains
`21d4e3c`, so metadata alone does not identify the build-file follow-up.

Deployment initially exposed source-directory ownership and an incomplete-transfer
asset problem. Both were corrected; all 163 checked server/frontend files then
matched the completed release. API health and public form/assets passed;
anonymous private/admin routes returned 401; missing/forged tokens returned 403
without storing smoke requests; a controlled eight-request burst returned six
403s followed by two 429s. A fresh real Turnstile token submitted successfully;
the synthetic request was rejected and no access was granted.

Live replay validation remains pending because automatic approval review blocked
exporting the captured token as a credential. Automated tests cover replay
failure. Fresh Auth0 sign-in and real invitation delivery were not verified in
this release. Production was not deployed. Preserve the dated distinction between
passed checks and these remaining validation tasks.

## Cemetery assignment audit

After account-data restores or changes to onboarding, check the target application
database in a read-only transaction. Include inactive accounts; system admins are
exempt. Run through the documented database connection for that environment:

```sql
BEGIN READ ONLY;
SELECT u.email, u.display_name, u.role_name, u.is_active,
       count(a.cemetery_id) AS cemetery_assignments
FROM app_users u
LEFT JOIN app_user_cemetery_access a ON a.app_user_id = u.id
WHERE u.role_name <> 'admin'
GROUP BY u.id, u.email, u.display_name, u.role_name, u.is_active
HAVING count(a.cemetery_id) <> 1
ORDER BY u.email;
ROLLBACK;
```

Zero rows means every non-admin account has exactly one assignment. Review any
zero-assignment or multiple-assignment account with its administrator and select
the intended cemetery in Admin → Users; do not infer an assignment from free-text
access requests. Creating or saving non-admin accounts requires an assignment,
but existing records are not backfilled and direct SQL can bypass validation.
The initial map is empty for a non-admin account without exactly one assignment.
System admins initially see all cemeteries.

Read-only audit on October 17, 2026 found no unassigned non-admin accounts in local
DEV, local TEST, or hosted TEST. Local databases each contained one active admin;
hosted TEST contained one active admin and one active, assigned power user. This
is a dated account-data observation, not confirmation that PR #685 is deployed.


## Passageway and recent map changes — release prerequisite

PR #744 merges migrations 502–504 and the passageway UI; preceding merged map
corrections are summarized in [Map Layout and Passageways](map-layout-and-passageways.md).
A merge or a successful DEV migration is not evidence of hosted deployment.
Inspect hosted migration status and apply every pending reviewed migration in
order, with a backup and environment-specific rehearsal; do not replay DEV
coordinates manually or mark pending migrations executed. The automated TEST
release does not apply migrations and refuses a database with pending changes.

Migrations 496–504 were subsequently rehearsed and applied to hosted TEST on
October 30; see [the dated verification record](#october-30-2026-main-release-and-migration-verification).
The procedure above remains required for future pending migrations.

The new API requires schema changeset `502-passageway-area-type`. Verify startup
and health after the separately authorized release, then confirm ten passageways,
individual gravesite deed support, blocked whole-passageway ownership and the
C-P03 expansion. Confirm all fixed monuments, existing grave/ownership assignments
and E/G gravesite-only behavior remain intact. Preserve the hosted deployment
record separately from the dated DEV evidence.

## October 30, 2026 main release and migration verification

Hosted TEST was deployed from `main` commit
`f6f01107e1c17e694bcdcb5dcd31f523b7766968`
([PR #770](https://github.com/scpeterson/CemeteryMapping/pull/770)), replacing
`2ddcb62faa8f3390d93ad99fc733c66caf3ed7a0`. The frontend/API build metadata is
`2026-10-30T23:20:28Z`. The exact commit's required CI gate passed before release.
This deployment supersedes earlier code-release metadata in this runbook.

At this October 30 release, hosted PostgreSQL remained **17.5 / PostGIS 3.5.2**
on its original image and volume. This historical state is superseded by the
November 5 hosted cluster upgrade documented in the
[PostgreSQL upgrade guide](postgresql-18-upgrade.md).
Existing hosted Auth0, restricted API credentials, frontend settings and tunnel
configuration were retained. The deployment did not copy local DEV/TEST data to
the host or apply any spatial-repair preview candidates.

### Pending migration rehearsal and application

The first `npm run deploy:test` attempt stopped before code cutover because the
hosted database was at migration 495. It left live services unchanged. Following
the release prerequisite above, a validated hosted database dump was restored to
an isolated container using the same PostgreSQL/PostGIS image, with no published
ports or access to the live volume. The full committed changelog applied the nine
pending migrations in order; none was skipped, manually replayed or marked run.

| Migrations | Reviewed scope |
| --- | --- |
| 496 | Retire thirteen defunct Section D temporary lots while retaining their outlines/history. |
| 497–500 | Align the northern D row, number D-78 and shift the reviewed D lot groups around fixed markers. |
| 501 | Deflect the shared D/E corner while preserving the combined footprint. |
| 502 | Add passageway types, location references and individual-gravesite ownership constraints. |
| 503 | Create ten reviewed passageways. |
| 504 | Shift the 32 southern C lots and expand C-P03 to their new northern edge. |

Rehearsal compared every non-extension public application table before and after.
Only `lots`, `sections`, `audit_events` and `databasechangelog` changed. All 808
graves and all existing lot UUIDs were preserved; total stored lots increased from
219 to 229. All other application table fingerprints matched. Existing spatial
findings remained present; migration success was not treated as a clean spatial
validation result.

Before live application, the application/settings and media were backed up. During
a brief API/web pause, a final database dump was validated and the live lots,
sections, cemetery, grave and headstone fingerprints were checked against the
rehearsed input. Migrations 496–504 then ran successfully. The same preservation
checks passed on the live database, with ten active passageways and no pending
changesets. Runtime API grants were refreshed using the existing password.
The previous code release was checked healthy before rerunning the normal release
command. PostgreSQL and the tunnel remained running during this maintenance.

### Code release verification

The subsequent `npm run deploy:test` completed its normal candidate/cutover
workflow. Verification confirmed:

- Candidate startup with Auth0 enabled, restricted database configuration and the
  default Node runtime user; the protected environment file was readable with
  mode `0600`.
- Database-backed TEST health matched the selected full commit and build time.
- All 167 deployed `server/` and `shared/` runtime files matched their release
  hashes; the API had zero restarts after cutover.
- Nginx configuration, local public frontend content and the hosted HTTPS public
  page passed. Anonymous `/api/me` and `/api/search` access returned 401.
- Account/access-request and media preservation checks passed. Protected settings
  were unchanged apart from release metadata; tunnel-token ownership was retained.

The deployed API image is
`sha256:46b0a518cbde3e2f3e8c6ac732c9aa2b090b8014dd4dd61f628722951db411f6`.

### Search and map smoke verification

A read-only smoke test ran the deployed repository code inside the API container,
using its existing `cemetery_api` credentials. It confirmed 808 stored graves,
785 map-visible active graves, ten passageways, exact search and grave-detail
reads. This was a backend smoke test, not an authenticated browser session.

Broad search (`a`) had a median of **220 ms** across five measured calls after two
warmups (observed range 218–226 ms). This is repository execution including
connection/transaction overhead; it excludes HTTP, Auth0 validation and browser
rendering. No comparable pre-release hosted baseline was collected, so these
numbers are not a hosted speedup claim or directly comparable with local timings.
The single checked-out backend reported `jit=on` again after search, confirming
that [the transaction-local JIT policy](adr/0195-search-transaction-local-jit.md)
did not change its subsequent session setting.

Fresh interactive TEST Auth0 sign-in, invitation delivery, Turnstile replay and
browser editing of passageways were not exercised by this release verification.
Existing validation gaps in older dated records are not implicitly closed by
these backend checks. Whole-passageway ownership rejection and E/G gravesite-only
behavior have automated coverage; no synthetic ownership or access records were
written to live TEST for this deployment.

### Retained recovery and evidence

Protected migration backups and before/after manifests are retained on the host
under `/srv/nhcemeteries/backups/20261030T231322Z-f6f01107e1c1-d296380c-schema`.
They include `rehearsal-report.json`, `live-migration-report.json`, rehearsal and pre-migration
database dumps, application/settings recovery material and the media snapshot.
The disposable rehearsal container and its own volume were removed after checks;
the live volume was retained.

The code-release recovery directory is
`/srv/nhcemeteries/backups/20261030T232028Z-f6f01107e1c1-96c502f8`;
its staging directory under `/srv/nhcemeteries/staging/` has the same release ID
and contains `verification.json` and protected command logs. Detailed plans,
credentials, raw records and backup contents are not published in this runbook.

Code rollback does not undo these data migrations, whose rollback actions are
empty. Use a reviewed forward correction or pre-migration backup recovery that
accounts for subsequent hosted edits. Retain both migration and code-release
recovery materials; do not use Liquibase rollback/reapply to infer data recovery.

## November 4, 2026 GeoNames configuration verification

GeoNames username configuration was added to the existing protected backend runtime environment, and only the API container was recreated to load it. The previous runtime environment was retained as a protected backup. API health passed, and search plus authority-record verification for Pittsburgh succeeded from inside the running TEST API container using `cemetery_app_geoname`.

This was a configuration-only change: it did not deploy the profile/membership feature (migration 509) or military-unit field (migration 510), refresh cemetery data, or verify a fresh interactive Auth0 login. The observed API revision was `5587072dd8581ff3ec1fe86569e5381f0d9a5838`, with build time `2026-11-04T13:53:46Z`. These observations supplement the older dated release records; check live migration status before the next feature release.

### Next profile and military-unit feature release

Migration 509 adds self-service profiles, account activity, and explicit cemetery membership roles. Migration 510 adds burial military units. They were applied and verified in local DEV on November 4 and November 5 respectively; that does not establish hosted TEST deployment. Use the normal reviewed migration rehearsal and release process, refresh the restricted API grants, and deploy the frontend and API together. Preserve TEST identities, memberships, contact/preference data, activity timestamps, access requests, audit history, and tester changes.

After deployment, verify **My profile**, **Admin → Users**, a mixed-role account across two cemeteries, and saving/displaying/clearing a **Military unit / organization**. Also repeat a GeoNames search and verification from the API container, and record health version metadata and the actual migration state. General record-read visibility retains its prior rules; cemetery roles do not introduce private tenant boundaries.

## CI validation paths

CI runs quick checks, serial database integration tests and four isolated browser
shards in parallel. Recognized documentation-only PRs build and validate the docs;
every main push still runs application validation. The required
`Lint, build, and test` aggregate remains the hosted deployment gate. See
[ADR 0181](adr/0181-parallel-ci.md) for classification, caches, isolation and recovery.


## SQL efficiency release, November 5, 2026

Hosted TEST now runs merged revision `ee0df929f92e8c50ff4c28078fb730278ea0d022`
(PR #787), with migrations 511–512 and private query monitoring active. PostgreSQL
18.6/PostGIS 3.6.4 and the existing volume remain in use. A fresh database-copy
rehearsal verified migration, rollback and reapplication; live application table
fingerprints were unchanged by migration. API/web were rebuilt and restarted
through the standard candidate/backup/recovery workflow after exact-revision CI.

Health/source integrity, Auth0/runtime settings, account/media preservation and
HTTPS passed, with zero API restarts. The deployed restricted role passed read-only
NHG review, report, search and selector checks; diagnostic access is denied and JIT
settings are restored after scoped queries. See the [implementation and monitoring
record](postgresql-18-upgrade.md#sql-efficiency-implementation-2026-11-05) and
[ADR 0196](adr/0196-measured-sql-efficiency.md). No spatial correction was included.


## November 6 DEV release before TEST promotion

The seven feature PRs #789–#795 and dependency PRs #796–#799 are merged. DEV runs
`9aec56d2b4bde06dde2491d530e78b30b12b32a6` with migrations through 516.
This records the earlier DEV deployment. The hosted TEST promotion completed later
the same day, as recorded below; it does not establish a later DEV revision.

Rehearse pending migrations, retain database/media recovery material, refresh API
role grants and deploy matched frontend/API through the existing release process.
Preserve TEST account/membership data, field receipts, staged sources, merge evidence
and maintenance schedules. Verify registered mixed-role accounts, conflict recovery,
private exports and task reminders, plus the built offline shell over HTTPS.
See [release status and checks](release-status.md#promotion-to-test) and
[current schema requirements](rebuild.md#current-schema-and-workspace-release).


## November 6, 2026 hosted TEST release

Hosted TEST was deployed at `8c01749e00129a88dcaa08bf9bedb518c5b22e6e`
([PR #808](https://github.com/scpeterson/CemeteryMapping/pull/808)). The frontend
build time is `2026-11-06T17:34:29Z` (12:34:29 PM EST); post-cutover health
reported the selected commit, environment `TEST`, and database
`cemetery_mapping_test`. This supersedes the November 5 code-release record above.
PostgreSQL 18.6/PostGIS 3.6.4 and the existing live volume remained in place.

### Deployed scope

- Feature PRs #789–#795: cemetery membership administration, concurrent-edit
  protection, encrypted field collection, cemetery onboarding/reviewed imports,
  deleted-record recovery and person merges, CSV/GeoJSON exports, and maintenance
  assignment/scheduling/reminders.
- Dependency PRs #796–#799: Vite 8.3.5, MapLibre GL 6.16.0, Lucide React 1.66.0,
  and ESLint 10.14.0. TypeScript remains 6.0.3. PR #273 was closed without merging;
  [PR #801](https://github.com/scpeterson/CemeteryMapping/pull/801) ignores
  TypeScript 7.x Dependabot updates.
- [PR #807](https://github.com/scpeterson/CemeteryMapping/pull/807): the
  “Markers without linked gravesites” quality metric excludes markers classified
  as plot markers by either marker type or scope.
- PR #808: generate the offline asset manifest from files actually emitted by the
  build, after final chunk naming. Deployment smoke testing found a missing
  vendor-map asset in the earlier manifest. Vite preview's HTML fallback had
  hidden the missing asset from the former browser regression; that regression
  now requires each manifest asset to return 200 with a non-HTML content type.

The first code cutover reached `dacb3a8958be80667d4d59f8365264bba69b6518`.
The missing offline asset was then reproduced, corrected through PR #808, and
redeployed through the same release process after exact-revision main CI passed.

### Schema rehearsal and preservation

The release prerequisite stopped the initial code deployment before cutover
because migrations 513–516 were pending. A validated hosted dump was restored
into a disposable PostgreSQL/PostGIS container with no published ports or live
volume access. The restore used a clean database created from `template0` to
avoid conflicts with schemas precreated by the PostGIS image.

| Migration | Scope |
|---|---|
| 513 | Private field synchronization receipts and retry identity. |
| 514 | Staged cemetery import batches and review decisions. |
| 515 | Reviewed burial-merge evidence and guards on active burial references. |
| 516 | Maintenance assignees, due/reminder dates, queue indexes and reminder reset. |

The full committed changelog passed rehearsal. Fingerprints of the original
columns in all 79 existing non-extension application tables matched before and
after; new schema objects and maintenance scheduling columns were expected.
API/web were briefly paused for a fresh final database backup and live migration.
The same preservation checks passed on live TEST, media was preserved, restricted
API grants were refreshed using the existing credentials, and Liquibase reported
no pending changes. The prior code was healthy again before normal code release.
No DEV restore, demo seeding, or environment reset was performed.

### Deployment and read-only verification

- The final main revision passed the required `Lint, build, and test` CI gate.
- Candidate startup passed with Auth0 enabled, restricted `cemetery_api`
  credentials, the Node runtime user, and the private environment file at mode
  `0600`.
- API/database health, all 196 deployed server/shared runtime hashes, local
  frontend integrity, public HTTPS, and rejection of anonymous private API access
  passed. The API had zero restarts after cutover.
- Account/access and media preservation checks passed. Protected host settings
  and tunnel-token ownership were retained.
- Read-only queries using the deployed restricted role passed across all three
  active cemeteries: membership lists, field marker selectors, maintenance queues,
  reminder summaries, and gravesite GeoJSON exports. The new receipt, import, and
  merge-evidence tables were readable, and the quality metric used its updated
  plot-marker exclusion. These reads do not establish write-workflow coverage.
- All 46 field-shell/manifest asset URLs checked at the origin returned 200;
  listed assets returned non-HTML content. The strengthened built offline reload
  regression passed locally and in CI. This automated result is separate from
  the pending disconnected hosted-browser check below.

### Interactive login, device persistence and synchronization

The user completed a fresh Cloudflare Access/application login in the TEST browser.
The field workspace then verified the account as Scott Peterson. Offline page
preparation completed with “Offline page loading is ready.”

Memorial Grove had no downloadable markers, so a separate Trinity Lutheran Church
Cemetery verification workspace downloaded `TLC-HS-0004`. Its existing marker
values were saved unchanged to queue a synchronization operation. A browser
reload with the network still available, followed by unlocking the encrypted
workspace, preserved the downloaded marker and the queued action.

After reconnecting the original account, authenticated synchronization reported
“Saved changes and photos are synchronized. Downloaded records were refreshed,”
and the queue showed zero pending actions with the marker operation marked
“Synchronized.” No photo was uploaded in this check. The unchanged-value save
exercised the write/receipt path and may update audit/version metadata; it did not
intentionally change marker content.

### Pending hosted offline reload test

**Still pending:** a real network-disconnected reload and a save made while offline,
followed by authenticated synchronization after reconnection. The user deferred
this step because they could not disconnect Wi-Fi. Do not treat the connected
reload or the automated CI offline test as completion of this hosted check.

The prepared Trinity device workspace was retained in the same browser profile.
When testing resumes:

1. Confirm the workspace is available and retain its temporary verification
   passphrase separately; no passphrase is stored in this documentation.
2. Disconnect the device from all networks and reload `/field/`. Confirm the
   field shell loads and displays its offline state.
3. Unlock the saved Trinity workspace and confirm downloaded marker `TLC-HS-0004`
   is available. Save its existing marker values unchanged on the device.
4. Reconnect, verify the original account, and synchronize. Confirm the queued
   action is acknowledged, the queue returns to zero, and the refreshed marker
   values remain unchanged. Record the actual outcome before closing this gap.

The same browser profile and intact site storage are required to resume this
workspace. Browser profile/site-data cleanup can remove local verification work.
Fresh photo capture/upload, identity-mismatch rejection, mixed-role access across
two cemeteries, conflict resolution, import approval, merge/recovery mutations,
and end-user task-reminder behavior were not exercised interactively in this
release check; prior CI coverage and read-only smoke results do not close those
interactive gaps.

### Recovery and evidence

Protected recovery material remains on the TEST host:

- Schema rehearsal/live migration:
  `/srv/nhcemeteries/backups/20261106T170231Z-dacb3a8958be-d3254a09-schema-retry1`,
  including validated rehearsal/final dumps, application/media recovery material,
  and `rehearsal-report.json` / `live-migration-report.json`.
- Final code release:
  `/srv/nhcemeteries/backups/20261106T173429Z-8c01749e0012-287cbef2`.
- Final release evidence:
  `/srv/nhcemeteries/staging/20261106T173429Z-8c01749e0012-287cbef2/verification.json`.

The final API image is
`sha256:1ec31702505ecd706e9092a2020d2792cb50e294dbba4b697476dd00c3bebda3`.
The disposable rehearsal container and its volume were removed. Retained backups
contain private data and must remain outside Git. This TEST deployment does not
establish a STAGE or PROD deployment.


## November 7, 2026 dependency and bundle release

Hosted TEST was deployed at `3c5609f685d30a0c3104dd91eab27bc827b4f2e2`,
superseding the November 6 code revision `8c01749`. Frontend build time was
`2026-11-07T14:55:41Z` (9:55:41 AM EST); post-cutover health verification completed
at `2026-11-07T14:58:02Z` (9:58:02 AM EST). These are deployment observations,
not a fresh interactive verification on the documentation update date.

### Dependency updates and bundle fix

| Dependency | Deployed version | Merged PR |
|---|---|---|
| `concurrently` | 10.0.6 | [#802](https://github.com/scpeterson/CemeteryMapping/pull/802) |
| `lucide-react` | 1.67.0 | [#803](https://github.com/scpeterson/CemeteryMapping/pull/803) |
| `@types/node` | 26.6.6 | [#804](https://github.com/scpeterson/CemeteryMapping/pull/804) |
| `express-oauth2-jwt-bearer` | 1.11.0 | [#805](https://github.com/scpeterson/CemeteryMapping/pull/805) |
| `@auth0/auth0-react` | 2.30.0 | [#806](https://github.com/scpeterson/CemeteryMapping/pull/806) |

The release lockfile was checked for all five versions; the running API's
installed JWT middleware was separately verified as 1.11.0. `@types/node` is a
build-time dependency, not an installed production runtime requirement.
TypeScript remains 6.0.3, with TypeScript 7.x Dependabot updates ignored.

PR #806 also consolidates shared permissions, task-reminder and record-search
modules into the existing `workspace-shared` chunk. This removes three small
chunks and repeated import overhead. Measured local production builds with the
upgraded Auth0 SDK reduced core JavaScript from **700.28 to 699.46 KiB gzip** and
all JavaScript from 729.11 to 728.20 KiB gzip (42 to 39 JavaScript chunks).
The core budget remains **700 KiB**; no budget allowance was increased. These
are local production-build measurements, not hosted TEST transfer-size timings.

### Deployment verification

- The selected main revision passed the required `Lint, build, and test` gate
  before deployment. PR validation also passed production bundle enforcement,
  all eight bundle-budget tests and the built offline field-shell regression.
- The normal backup/candidate/cutover workflow deployed matched frontend/API
  artifacts. Schema validation was up to date; no new migrations were required,
  and the schema remains through migration 516.
- Candidate startup verified Auth0 configuration, the restricted API database
  role, the Node runtime user and mode-`0600` environment-file permissions.
- Post-cutover health identified the exact selected commit, environment `TEST`
  and database `cemetery_mapping_test`. All 196 deployed server/shared runtime
  hashes matched; the API had zero restarts.
- Frontend integrity, public HTTPS and anonymous private-API rejection passed.
  Accounts/access records, media, protected settings and tunnel-token ownership
  were preserved; no database refresh, seeding or environment reset was done.
- All **43** checked field-shell/manifest asset URLs returned HTTP 200 at the
  origin; manifest assets returned non-HTML content. The lower count reflects
  the three consolidated JavaScript chunks, compared with 46 URLs on November 6.

### Offline verification remains pending

**Still pending:** a real network-disconnected reload of hosted TEST, a save made
while offline, and authenticated synchronization after reconnection. The user
previously deferred disconnection because Wi-Fi could not be turned off. This
release did not complete or repeat that test. Follow the
[pending hosted offline reload steps](#pending-hosted-offline-reload-test).

The November 6 user-assisted login, offline preparation, **connected**
reload/unlock and unchanged-value synchronization remain historical evidence for
that earlier release. Fresh interactive login and authenticated synchronization
were **not repeated after the November 7 Auth0/JWT updates**. Automated offline
regressions and successful asset requests do not close these live verification
gaps. The previously prepared browser workspace may be reused only if its browser
profile and site storage remain intact; its availability was not rechecked for
this deployment. No photo synchronization was performed.

### November 7 recovery material

Protected host recovery and verification files are retained at:

- Backup: `/srv/nhcemeteries/backups/20261107T145541Z-3c5609f685d3-06da2b92`.
- Release report:
  `/srv/nhcemeteries/staging/20261107T145541Z-3c5609f685d3-06da2b92/verification.json`.
- Dependency and asset smoke report:
  `/srv/nhcemeteries/staging/20261107T145541Z-3c5609f685d3-06da2b92/smoke-verification.json`.

The deployed API image is
`sha256:7ee9266da734149f8cf6c47425f5ae5b78232a27b6fb08347c26052ecfe2889e`.
Keep private recovery data outside Git. This record establishes hosted TEST
availability only; it does not establish a STAGE or PROD deployment.

## November 9, 2026 refactoring and draft recovery release

[PR #811](https://github.com/scpeterson/CemeteryMapping/pull/811) was deployed to
hosted TEST at commit `0b6d9c9a6bf5427e7c6f40b22cb8475f3c59d407`, replacing
`3c5609f685d30a0c3104dd91eab27bc827b4f2e2`. The release build time was
`2026-11-09T17:05:48Z` (12:05:48 PM EST); post-cutover health was verified at
`2026-11-09T17:08:22.540Z` (12:08:22 PM EST).

The release includes the inspection editor, detail fetching, CemeteryMap and
record-option refactors, debounced inspection recovery writes with lifecycle
flushing, and unsaved-draft comparisons moved from each edit to navigation/unload.
See [ADR 0205](adr/0205-debounced-inspection-recovery.md) and
[ADR 0206](adr/0206-draft-guard-navigation-comparison.md) for behavior, profiling
evidence and validation scope. The reviewed core JavaScript budget is now
**701 KiB gzip**; the November 7 section's 700 KiB figure is historical.

### Release preparation and cutover

- The exact merged main revision passed the required **Lint, build, and test**
  CI gate before deployment. The standard release command built a clean source
  archive using Node.js 24 and the existing hosted frontend settings.
- Initial attempts stopped before cutover because a restrictive local `umask`
  produced unreadable source files for the Liquibase validator and candidate
  Node process. The previous release stayed healthy. Rebuilding with `umask 022`
  allowed the unmodified deployment workflow to complete; hosted secrets retained
  their protected permissions. Do not loosen secret-file permissions to resolve
  source readability problems.
- Liquibase validation passed and schema status was up to date. No migrations,
  database refresh, restore or seeding ran. Database and tunnel containers stayed
  running while only API/web services switched to the new release.
- Validated database dumps, application/settings recovery material and a verified
  media snapshot were retained before cutover. The API image was built without
  cache and the isolated candidate passed startup, Auth0, restricted database-role,
  runtime-user and private environment-file checks before the switch.

### November 9 deployment verification

- Origin health reported `ok`, environment `TEST`, database
  `cemetery_mapping_test`, the exact selected commit and matching build time.
  All **196** deployed server/shared runtime hashes matched the release manifest;
  the API had **zero restarts** at verification.
- The API ran as `node` with a readable mode-`0600` private environment file and
  the restricted `cemetery_api` database role. Protected configuration, media,
  account/access records and tunnel-token ownership were preserved. Runtime
  metadata changed only as required to identify the new release.
- Before/after row counts and content fingerprints matched across **83 tables**.
  `audit_events` and `system_events` were excluded because operational logging
  and retention can change them. This comparison describes deployment-time data,
  before the later synthetic burst-protection verification request.
- All **44** field-shell/manifest asset URLs returned HTTP 200 at the origin.
  Non-page responses were non-HTML and matched deployed file hashes.
- Restricted-role, read-only application smoke checks covered **3 cemeteries**:
  map data, **3 grave details**, **2 headstone details**, **6 record-option
  queries** and **3 searches**. These exercised deployed repository/database reads,
  not a fresh authenticated browser session.
- Public HTTPS `/request-access` returned 200. Anonymous private API access was
  rejected with 401 at the origin and redirected to Cloudflare Access with 302
  through the public hostname. Frontend integrity and Nginx configuration checks
  passed.

Fresh interactive Access/Auth0 sign-in and a real disconnected offline
reload/save/reconnect synchronization test were **not performed for this
deployment**. The [pending hosted offline steps](#pending-hosted-offline-reload-test)
remain open; asset and read-only smoke checks do not close that gap. The later
[burst-protection verification](#november-9-2026-cloudflare-burst-protection)
separately exercised a real Turnstile-backed access request, without granting an
account.

### November 9 recovery material

Protected host artifacts for the successful release are retained at:

- Backup: `/srv/nhcemeteries/backups/20261109T170548Z-0b6d9c9a6bf5-f5e564b1`.
- Release report:
  `/srv/nhcemeteries/staging/20261109T170548Z-0b6d9c9a6bf5-f5e564b1/verification.json`.
- Asset, read-only smoke and data-preservation report:
  `/srv/nhcemeteries/staging/20261109T170548Z-0b6d9c9a6bf5-f5e564b1/smoke-verification.json`.

The deployed API image is
`sha256:118bd8addf55b4ef611f3844a754e8f1f145716382e686d8dfd9f462f63e096f`.
Keep recovery archives, settings, secrets and raw database records outside Git.
This record establishes hosted TEST deployment only; it does not establish a
STAGE or PROD deployment. Documentation-only PRs after this release do not change
the running API revision; check `/api/health` before planning another release.

## November 9, 2026 Cloudflare burst protection

The **Access request burst protection** rate-limiting rule is active in the
`nhcemeteries.org` Cloudflare zone. Its rule ID is
`5f40a4d3b1a549aba83d0962b23079c1`; inspect it under **Security → Security rules →
Rate limiting rules**, or use the
[rule dashboard](https://dash.cloudflare.com/05d74c95ee93c4804f7a05ca2c4c91fd/nhcemeteries.org/security/security-rules/rate-limiting-rules/5f40a4d3b1a549aba83d0962b23079c1).

| Setting | Saved value |
|---|---|
| Match | `(http.request.uri.path eq "/api/access-requests")` |
| Counting characteristic | Client IP |
| Threshold | More than 5 requests in 10 seconds |
| Action | Block for 10 seconds |
| Status | Active |

The Free-plan rule matches the exact path **across the zone**, including TEST;
it is not restricted to the TEST hostname or to POST requests. It does not match
`/request-access`, its assets, or other API paths. The rule uses the zone's one
available Free-plan rate-limiting rule. Edge counters are not an exact global
transaction limit: enforcement can lag the configured threshold. Keep the origin
limits as well. See [Cloudflare rate limiting](https://developers.cloudflare.com/waf/rate-limiting-rules/).

This change added only the edge rule. Cloudflare Access, Auth0, the Free Managed
Ruleset, HTTP DDoS protection and Browser Integrity Check were preserved. Bot
Fight Mode remained off. Turnstile's required server-side verification, exact
hostname/action checks, trusted loopback proxy handling, Nginx/API request limits
and database queue/hourly ceilings remain in place. No application deployment,
schema change, credential change, or account provisioning was performed.

### Hosted verification on November 9

- Reopened the saved rule and confirmed the exact expression, client-IP counter,
  threshold, period, block duration and Active status.
- Submitted one synthetic request through the public TEST form in Chrome with a
  real Turnstile token. The browser displayed the received/review message, and
  the database contained the corresponding pending request. The fixture was
  subsequently marked **rejected**, with an audit reason identifying the
  verification. It remains historical; no user account was created.
- Sent a bounded burst of 12 GET requests to the exact API path. GET cannot
  submit an access request and normally returns 404. Six responses were 404 and
  six were Cloudflare 429 rate-limit pages. After a 15-second cooldown, a new GET
  returned 404 without a Cloudflare rate-limit page. These observations verify
  edge blocking and recovery; they do not promise an exact sixth-request cutoff.
- Missing-token and forged-token POSTs both returned the application's 403
  verification error. Neither created an access-request record.
- The public form returned HTTP 200, anonymous `/api/me` still redirected to
  Cloudflare Access (302), and origin health remained `ok` in environment `TEST`.
- Running configuration still required Turnstile, included the exact TEST
  hostname, and trusted only the configured loopback proxy. No secrets or tokens
  were recorded in this runbook.

### Monitoring, retesting and recovery

Review **Security → Analytics → Events** for this rule ID and TEST hostname;
allow for analytics delay and sampling. Distinguish Cloudflare rate-limit pages
from origin 429 responses before changing limits. A successful browser request
alone does not establish that it was stored: verify the synthetic pending record,
then reject it without granting access. Never disable Turnstile to test success.

For a bounded retest, use GETs to the exact API path so burst probes cannot create
records. Allow the cooldown before checking recovery, and test an ordinary
Turnstile-backed form submission separately. Avoid flooding the live form or
using business records as fixtures.

If the edge rule causes legitimate-request failures, disable **only this named
rate-limiting rule** while investigating, retain its configuration, and preserve
all origin verification, rate limits, capacity controls and Access policies.
Recheck the public form, valid/invalid token handling and private-API protection.
The rule is managed in Cloudflare rather than the application checkout; a code
rollback does not remove it.

## November 10, 2026 versioned TEST deployment

Published annotated tag **`v0.2.0`** was deployed using the exact-release command,
resolving to `ed2266812b9bd852134c31c7c56a2a8cff3d57a1`. It replaced package
0.1.0 at `0b6d9c9a6bf5427e7c6f40b22cb8475f3c59d407`. The tag was not moved and
later documentation commits are not part of the deployed application.

```sh
umask 022
npm exec --yes --package=node@24 -- npm run deploy:test -- --ref v0.2.0
```

The local build runtime was Node.js 24.22.2. The selected revision belonged to
`origin/main`, its package version matched the tag, and its exact-commit CI gate
had passed before deployment. The standard workflow built the tagged source with
existing hosted public settings, validated schema status, retained verified
database/application/media recovery material, built the committed API Dockerfile
without cache, and checked the isolated candidate before cutover. No migration,
database restore, refresh, seeding, database release tag, or configuration reset
was performed. Database and tunnel services stayed running.

The release build time is **`2026-11-10T13:51:40Z`** (8:51:40 AM EST);
post-cutover health was verified at **`2026-11-10T13:54:50.231Z`**
(8:54:50 AM EST).

### Verification results

- API health reported `ok`, version **0.2.0**, environment `TEST`, database
  `cemetery_mapping_test`, the exact tagged SHA and matching build time. Compiled
  frontend metadata in `workspace-shared-D4MKPDiY.js` matched the API's version,
  full SHA and build time. The environment-label exception below remains open.
- All **196** deployed server/shared runtime hashes matched. The API ran as
  `node`, used the restricted `cemetery_api` role, had a readable mode-`0600`
  private environment file, and had **zero restarts** at release verification.
- Schema validation passed with no pending migrations: **518 applied changesets**,
  through migration file **516**. No live schema or release-tag metadata changed.
- Before/after row counts and content fingerprints matched across **83 tables**.
  `audit_events` and `system_events` were excluded because operational logging and
  retention can change them. Account/access records, media inventory, protected
  settings and tunnel-token ownership also passed the standard preservation
  checks; runtime settings changed only in `GIT_SHA` and `BUILD_TIME`.
- All **44** field-shell/manifest URLs returned HTTP 200 at the origin. Non-page
  assets were non-HTML and matched deployed hashes. Restricted-role read-only
  checks covered map data across **3 cemeteries**, **3 grave details**, **2
  headstone details**, **6 record-option queries** and **3 searches**.
- Public HTTPS `/request-access` returned 200. Origin anonymous private API access
  returned 401; public `/api/me` redirected to Cloudflare Access with 302. Nginx
  configuration and frontend integrity passed the release checks.
- Hosted Auth0, required Turnstile verification, exact TEST hostname validation
  and trusted loopback proxy handling remained enabled. Missing-token and
  forged-token POSTs returned the application's 403 verification error and
  created **zero** access-request records. No account was provisioned.
- The existing Cloudflare edge burst protection remained effective: a bounded
  12-GET probe on `/api/access-requests` returned **4×404 and 8×429**, with 7
  responses identified as Cloudflare rate-limit pages. After 15 seconds, a new
  GET returned the normal 404 without a rate-limit page. These GETs cannot submit
  access requests. The observed count is not an exact global cutoff guarantee;
  the existing edge and origin limits were preserved without reconfiguration.

### Existing environment-label discrepancy and pending live checks

The compiled frontend environment label is **`DEV`**, while API environment is
correctly **`TEST`**. The retained previous 0.1.0 build also contains `DEV`, and
the unchanged hosted `frontend.env` does not set `VITE_APP_ENV`. The release
archive strips environment files before building, so the frontend falls back to
its default label rather than the tracked `.env.test` value. Version/SHA/build
identity matches; this is a separately verified pre-existing build-label issue.
Configuration was preserved as requested. Correcting the frontend environment
input needs a separate reviewed change; do not move the published tag or broaden
secret-file permissions to address it.

This discrepancy was subsequently resolved by
[v0.2.1](#november-10-2026-environment-label-and-version-badge-fix), without changing
hosted settings. The observations above remain the historical v0.2.0 evidence.

Fresh interactive Access/Auth0 sign-in, real invitation-email delivery, live
Turnstile token replay rejection, and a real disconnected offline
reload/save/reconnect synchronization test remain **pending**. No real
Turnstile-backed form submission was repeated for this deployment. Automated
checks, invalid-token rejection and asset/repository smoke checks do not close
these gaps. Retain the earlier dated browser evidence and follow the
[pending offline steps](#pending-hosted-offline-reload-test).

### November 10 recovery material

- Backup: `/srv/nhcemeteries/backups/20261110T135140Z-ed2266812b9b-c2c67afa`.
- Release report:
  `/srv/nhcemeteries/staging/20261110T135140Z-ed2266812b9b-c2c67afa/verification.json`.
- Supplemental asset, identity, schema, protection and data-preservation report:
  `/srv/nhcemeteries/staging/20261110T135140Z-ed2266812b9b-c2c67afa/smoke-verification.json`.

The deployed API image is
`sha256:c719f59b1fa843bb310f03360992c38ea04e33be70b9e4e0244a86728e4360ea`.
Retain private recovery material outside Git. This establishes a TEST deployment
only, not a STAGE or PROD deployment; use `/api/health` to check running identity.

## November 10, 2026 environment label and version badge fix

[PR #818](https://github.com/scpeterson/CemeteryMapping/pull/818) fixes the missing
frontend-label fallback and displays the application version directly in the map
badge. Explicit `VITE_APP_ENV` overrides remain authoritative; otherwise Vite's
selected dev/test/stage/prod mode supplies DEV/TEST/STAGE/PROD, including sanitized
builds without environment files. The version is visible in every environment;
SHA, build time and API details remain in the tooltip. Phone badges stack the
label and version to avoid map-control overlap.

The fix was published as immutable annotated tag **`v0.2.1`**, commit
`4aaf0504a40a708a2359c0d6c69a1757bd27fb64`, after full PR and exact-merged-commit
CI passed without rerun. The original `v0.2.0` tag remains unchanged. TEST was
then deployed with:

```sh
umask 022
npm exec --yes --package=node@24 -- npm run deploy:test -- --ref v0.2.1
```

Build time is **`2026-11-10T14:27:15Z`** (9:27:15 AM EST); final release health
was verified at **`2026-11-10T14:29:41.423Z`** (9:29:41 AM EST). This replaced
v0.2.0 at `ed2266812b9bd852134c31c7c56a2a8cff3d57a1` using the standard
backup/candidate/cutover workflow. Database and tunnel services stayed running;
no migration, database tag, restore, seeding or configuration change was needed.

### Fix and deployment verification

- Real builds of the actual environment module without environment files passed
  for all four modes, with explicit override and version/SHA/build checks. The
  focused 21-test browser suite passed; the final phone badge adjustment passed
  all 8 header regressions with non-overlap checks at 320, 390, 760, 768, 1280 and
  1920 pixels. Twelve existing protection/configuration tests, production build
  and unchanged bundle budgets, lint and documentation checks passed. Full PR
  and main CI also passed all browser shards and database/Docker checks.
- API health reported `ok`, **TEST**, version **0.2.1**, the exact tagged SHA and
  matching build time. All **198** server/shared runtime hashes matched (including
  the new shared environment helper/declaration), and the API had **zero restarts**.
- A fresh headless browser evaluated the deployed public metadata module
  `workspace-shared-lVvcbK4x.js`. Its runtime values were **TEST**, **0.2.1**,
  `4aaf0504a40a708a2359c0d6c69a1757bd27fb64` and `2026-11-10T14:27:15Z`, matching
  API metadata. This confirms resolution of the inherited DEV-label issue while
  hosted `VITE_APP_ENV` remains unset. The probe used the public request page via
  a temporary loopback-only SSH forward, blocked the widget script for this
  metadata-only check, submitted no form and then closed the browser/forward.
  It did not disable any hosted protection or establish a fresh authenticated
  login or real Turnstile submission.
- All **83** compared table fingerprints and row counts were unchanged, excluding
  operational `audit_events` and `system_events`. Standard account/access, media,
  protected-settings and tunnel-token ownership checks passed. The API still ran
  as `node` with the restricted `cemetery_api` role and mode-`0600` private env;
  runtime configuration changed only in `GIT_SHA` and `BUILD_TIME`.
- Schema remains **518 applied changesets through file 516**, with no pending
  migrations. All **44** field-shell/manifest URLs passed status, non-HTML asset
  and deployed-hash checks. Restricted-role read-only checks covered 3 cemeteries,
  3 grave details, 2 headstone details, 6 record-option queries and 3 searches.
- Public `/request-access` returned 200, origin anonymous private API access was
  rejected with 401, and public `/api/me` redirected to Cloudflare Access with 302.
  Required Turnstile, exact TEST hostname validation and trusted loopback proxy
  handling remained enabled. Missing/forged token POSTs returned application 403
  errors and created zero records.
- Existing edge burst protection/cooldown passed: 12 bounded GET probes returned
  4×404 and 8×429 (7 identified Cloudflare rate-limit pages); a new GET after 15
  seconds returned normal 404. No edge rule or origin limit was changed, and these
  GETs cannot submit an access request.

The frontend-label gap is now **resolved on TEST**. Fresh interactive
Access/Auth0 login, invitation delivery, live token replay, disconnected offline
reload/save/reconnect synchronization and a fresh real Turnstile-backed submission
remain pending. Building labels for STAGE/PROD does not establish deployments to
those environments. Historical records and pending verification scope remain intact.

### v0.2.1 recovery material

- Backup: `/srv/nhcemeteries/backups/20261110T142715Z-4aaf0504a40a-3d26dd7e`.
- Release report:
  `/srv/nhcemeteries/staging/20261110T142715Z-4aaf0504a40a-3d26dd7e/verification.json`.
- Supplemental preservation/asset/security/metadata report:
  `/srv/nhcemeteries/staging/20261110T142715Z-4aaf0504a40a-3d26dd7e/smoke-verification.json`.
- Browser runtime metadata evidence:
  `/srv/nhcemeteries/staging/20261110T142715Z-4aaf0504a40a-3d26dd7e/browser-metadata-verification.json`.

The deployed API image is
`sha256:c356e33e971c557f289bf9e97773cac2734991e9f581f9048ccce8a54920f10a`.
Retain protected recovery material outside Git. Later documentation-only merges
do not change this running application revision.

## November 10, 2026 header placement release

Immutable annotated tag **`v0.2.2`**, commit
`4f3f0c2827750dc24621e4cff877c83c1d7aa199`, is deployed to TEST. It includes
[PR #820](https://github.com/scpeterson/CemeteryMapping/pull/820), which moves
environment/version information to the right of **Cemetery Map** in the header,
removes the map overlay and keeps the badge visible in phone Search and Details.
[PR #821](https://github.com/scpeterson/CemeteryMapping/pull/821) prepared the
release version and notes. Full PR and exact-merged-commit CI passed without
rerun before publication; previous tags were not moved.

```sh
umask 022
npm exec --yes --package=node@24 -- npm run deploy:test -- --ref v0.2.2
```

The release replaced v0.2.1 at `4aaf0504a40a708a2359c0d6c69a1757bd27fb64`.
Build time is **`2026-11-10T15:08:18Z`** (10:08:18 AM EST); post-cutover health
was verified at **`2026-11-10T15:10:56.130Z`** (10:10:56 AM EST). The standard
workflow validated schema, retained database/application/media recovery material,
built the API image without cache, checked the isolated candidate and switched
API/web only. Database and tunnel services stayed running. No migration,
database tag, restore, seeding, account provisioning or configuration reset ran.

### v0.2.2 verification results

- API health reported `ok`, environment **TEST**, version **0.2.2**, the exact
  tagged SHA and matching build time. All **198** server/shared runtime hashes
  matched; the API ran as `node` with the restricted `cemetery_api` role and
  mode-`0600` private environment file, with **zero restarts** at verification.
- A fresh headless browser evaluated the deployed public metadata module
  `workspace-shared-Ba17O52O.js` and confirmed TEST, 0.2.2, the full tagged SHA and
  `2026-11-10T15:08:18Z`, matching API metadata. This metadata-only probe used the
  public request page through a temporary loopback SSH forward, blocked the
  widget script in its own context and submitted no form; the browser/forward
  were closed afterwards. Hosted protections were not disabled.
- Release browser regressions verified the badge beside the title and absent
  from the map at 320, 390, 760, 768, 1280 and 1920 pixels, plus visibility when
  the phone map is hidden in Search/Details. Auth/access-request regressions,
  production bundle enforcement, database/Docker and documentation checks passed.
  These are automated UI checks, not a new authenticated live-browser login.
- **83** before/after table counts and content fingerprints matched, excluding
  operational `audit_events` and `system_events`. Account/access records, media,
  protected settings and tunnel-token ownership passed preservation checks.
  Runtime configuration changed only in `GIT_SHA` and `BUILD_TIME`.
- Schema remains **518 applied changesets through file 516**, with no pending
  migrations. All **44** field-shell/manifest URLs passed HTTP status, non-HTML
  asset and hash checks. Restricted-role read-only smoke checks covered 3
  cemeteries, 3 grave details, 2 headstone details, 6 record-option queries and
  3 searches.
- Public `/request-access` returned 200, origin private API access rejected an
  anonymous request with 401, and public `/api/me` redirected to Cloudflare Access
  with 302. Auth0, required Turnstile, exact TEST hostname validation and trusted
  loopback proxy handling remained enabled. Missing/forged token POSTs returned
  application 403 errors and created **zero** access-request records.
- Existing burst protection/cooldown passed without changing edge or origin
  settings: 12 bounded GET probes returned 4×404 and 8×429, with 6 responses
  identified as Cloudflare rate-limit pages. After 15 seconds, a new GET returned
  normal 404 without a rate-limit page. GET probes cannot submit access requests;
  these observations do not promise an exact global cutoff.

Fresh live Access/Auth0 login, invitation delivery, token replay, disconnected
offline reload/save/reconnect synchronization and a fresh real Turnstile-backed
submission remain **pending**. Existing dated evidence remains intact; this TEST
release does not establish STAGE or PROD deployment. Refresh an already-open TEST
page to load the new header placement.

### v0.2.2 recovery material

- Backup: `/srv/nhcemeteries/backups/20261110T150818Z-4f3f0c282775-217fe980`.
- Release report:
  `/srv/nhcemeteries/staging/20261110T150818Z-4f3f0c282775-217fe980/verification.json`.
- Supplemental preservation/asset/security/identity report:
  `/srv/nhcemeteries/staging/20261110T150818Z-4f3f0c282775-217fe980/smoke-verification.json`.
- Browser runtime metadata evidence:
  `/srv/nhcemeteries/staging/20261110T150818Z-4f3f0c282775-217fe980/browser-metadata-verification.json`.

The deployed API image is
`sha256:fcc4d45e58f7a390678a79b99f4823605cc58ced05f612aba90543d02b9fce3a`.
Keep private recovery material outside Git. Later documentation-only merges do
not change the deployed application commit or version tag.

## November 10, 2026 NHG location matcher release

Immutable annotated tag **`v0.2.3`**, commit
`7f0d31d92bc8da9901b3104caef55846ff0cea7e`, is deployed to TEST, replacing
v0.2.2 at `4f3f0c2827750dc24621e4cff877c83c1d7aa199`.
[PR #823](https://github.com/scpeterson/CemeteryMapping/pull/823) adds complete
NHG section/row/site matching for UNKNOWN readings without requiring a page
reference, preserving existing surname, page and nearby-page marker suggestions.
[PR #824](https://github.com/scpeterson/CemeteryMapping/pull/824) prepared the
release. Full [release PR CI](https://github.com/scpeterson/CemeteryMapping/actions/runs/42847692379)
and [exact-merged-commit CI](https://github.com/scpeterson/CemeteryMapping/actions/runs/42849123771)
passed without rerun before publishing the tag. Previous tags were not moved.

```sh
umask 022
npm exec --yes --package=node@24 -- npm run deploy:test -- --ref v0.2.3
```

Build time is **`2026-11-10T16:01:38Z`** (11:01:38 AM EST); final health was
verified at **`2026-11-10T16:04:28.625Z`** (11:04:28 AM EST). The standard
workflow validated schema and source integrity, backed up database/application/
media, built the committed API Dockerfile without cache, checked an isolated
candidate and switched API/web only. Database and tunnel remained running.
No migration, database tag, data repair, refresh, restore, seeding or account
provisioning ran. Existing private/public settings and protections were preserved;
runtime configuration changed only in `GIT_SHA` and `BUILD_TIME`.

### v0.2.3 verification results

- **E-0567 is available for confirmation.** The deployed Readings repository,
  queried with page `230` and the latest default import batch using the restricted
  API role and database-enforced read-only connections, returns **E-0567**
  (`TLC-GPS-0567`, burial name `Illegible`) for **UNKNOWN (6E, 3, s)** under
  **Show more possible matches**. It also returns marker `TLC-HS-0567`.
  Both evidence arrays are empty and both saved-decision counts are **zero**.
  No link, rejection or field-check decision was submitted. Refresh TEST, filter
  Admin > Readings to page 230, find the final UNKNOWN reading and expand
  **Show more possible matches** to review it. This verifies the deployed
  repository response, not a fresh authenticated live-browser session.
- API health reported `ok`, TEST, version **0.2.3**, the full tagged SHA and
  matching build time. All **198** runtime server/shared hashes matched; API ran
  as `node` with restricted `cemetery_api`, private mode-`0600` environment file
  and **zero restarts** at verification.
- Compiled frontend metadata and a fresh browser evaluation of deployed public
  module `workspace-shared-B4lvuox8.js` agreed with the API on TEST, version, full
  SHA and build time. The public-request-page probe used a temporary loopback SSH
  forward, blocked the widget script only in its own browser context, submitted
  no form and closed browser/forward afterwards. Hosted protections stayed enabled.
- **83** before/after table counts and content fingerprints matched, excluding
  operational `audit_events` and `system_events`. Account/access records, media,
  protected settings and tunnel-token ownership passed preservation checks.
- Schema remains **518 applied changesets through migration file 516**, with
  no pending migrations. All **44** field-shell/manifest URLs passed HTTP,
  non-HTML asset and deployed-hash checks. Restricted-role read-only smoke checks
  covered 3 cemeteries, 3 grave details, 2 headstone details, 6 record-option
  queries and 3 searches. Release CI passed matcher database regressions,
  browser regressions, production bundle enforcement and documentation validation.
- Public `/request-access` returned 200; origin anonymous private API requests
  were rejected with 401; public `/api/me` redirected to Cloudflare Access with
  302. Auth0, required Turnstile, TEST hostname validation and trusted loopback
  proxy settings remained enabled. Missing/forged token POSTs returned application
  403 errors and created **zero** access-request records.
- Existing burst protection/cooldown passed without configuration changes:
  12 bounded GET probes returned 4×404 and 8×429, with **7** identified Cloudflare
  rate-limit pages. After 15 seconds, a new GET returned normal 404 without a
  rate-limit page. These GET probes cannot create access requests and do not
  promise an exact global cutoff.

Fresh live Access/Auth0 login, invitation delivery, token replay, disconnected
offline reload/save/reconnect synchronization and a fresh real Turnstile-backed
submission remain **pending**. The E-0567 read-only check and public metadata
probe do not close these gaps. Historical evidence remains intact; this release
does not establish STAGE/PROD deployment.

### v0.2.3 recovery material

- Backup: `/srv/nhcemeteries/backups/20261110T160138Z-7f0d31d92bc8-95d760bd`.
- Release report:
  `/srv/nhcemeteries/staging/20261110T160138Z-7f0d31d92bc8-95d760bd/verification.json`.
- Supplemental preservation/asset/security/identity report:
  `/srv/nhcemeteries/staging/20261110T160138Z-7f0d31d92bc8-95d760bd/smoke-verification.json`.
- Unconfirmed E-0567 evidence:
  `/srv/nhcemeteries/staging/20261110T160138Z-7f0d31d92bc8-95d760bd/reading-match-verification.json`.
- Browser runtime metadata evidence:
  `/srv/nhcemeteries/staging/20261110T160138Z-7f0d31d92bc8-95d760bd/browser-metadata-verification.json`.

The deployed API image is
`sha256:56310db09491138d39dbadd72f489bbaed0c3f285bb0462a4e0d5e677d7cd541`.
Retain private recovery material outside Git. Code rollback does not roll back
schema/data; later documentation-only merges do not change the deployed tag.

## November 10, 2026 NHG suggestion priority release

Immutable annotated tag **`v0.2.4`**, commit
`880650634483dc6709e67c9dd6bd8b746fe989a0`, is deployed to TEST, replacing
v0.2.3 at `7f0d31d92bc8da9901b3104caef55846ff0cea7e`.
[PR #826](https://github.com/scpeterson/CemeteryMapping/pull/826) prioritizes
exact NHG section/row/site matches in the main suggestions while retaining
existing candidates and review-completion behavior.
[PR #827](https://github.com/scpeterson/CemeteryMapping/pull/827) prepared the release.
The current [release PR CI](https://github.com/scpeterson/CemeteryMapping/actions/runs/42857136724)
and [exact-main CI](https://github.com/scpeterson/CemeteryMapping/actions/runs/42858568950)
passed before tagging. The PR was reopened when checks were delayed; GitHub
superseded/cancelled its earlier run. No code correction was needed. Prior tags
were not moved.

```sh
umask 022
npm exec --yes --package=node@24 -- npm run deploy:test -- --ref v0.2.4
```

Build time is **`2026-11-10T16:57:25Z`** (11:57:25 AM EST); final health was
verified at **`2026-11-10T17:00:18.918Z`** (12:00:18 PM EST). The workflow
validated source/settings/schema, backed up database/application/media, built
the tagged API Dockerfile without cache, checked an isolated candidate and
switched API/web only. Database and tunnel stayed running. No migration,
database tag, repair, refresh, restore, seeding or account provisioning ran.
Existing private/public configuration and protections were preserved; runtime
configuration changed only in `GIT_SHA` and `BUILD_TIME`.

### v0.2.4 verification results

- **E-0567 is first in the main suggestions.** The deployed Readings repository,
  queried with page `230` and the latest default import batch through restricted
  `cemetery_api` with database-enforced read-only connections, returns **E-0567**
  (`TLC-GPS-0567`) at **position 1** in **Possible existing matches** for
  **UNKNOWN (6E, 3, s)**. `exactNhgLocation` is true. Marker `TLC-HS-0567` is also
  returned. Both evidence arrays are empty and both saved-decision counts are
  **zero**. No confirmation was submitted. Refresh TEST and filter Admin >
  Readings to page 230 to review the final UNKNOWN reading without opening
  **Show more possible matches** for E-0567. This is deployed repository-response
  verification, not a fresh authenticated browser session.
- Regression coverage preserves all seven suggestions when E-0567 is promoted
  ahead of six higher-score candidates, stable order within priority groups,
  existing decisions and completed/pending review summaries. Promotion does not
  auto-confirm links or reopen completed readings. Full CI, browser regressions,
  production bundle enforcement and documentation validation passed.
- API health reported `ok`, TEST, **0.2.4**, the tagged SHA and matching build
  time. All **198** runtime hashes matched, with `node` runtime, restricted role,
  mode-`0600` private environment file and **zero API restarts** at verification.
- Compiled frontend identity and fresh public browser evaluation of
  `workspace-shared-DHbX1Zj7.js` matched the API's environment/version/SHA/build
  time. The probe used a temporary loopback SSH forward, blocked the widget
  script only in its own browser context, submitted no form and closed browser/
  forward afterwards; hosted protections stayed enabled.
- **83** before/after table counts and content fingerprints matched, excluding
  operational `audit_events` and `system_events`. Accounts/access records,
  media, protected settings and tunnel-token ownership passed preservation checks.
- Schema remains **518 applied changesets through migration file 516**, with
  no pending migrations. All **44** field-shell/manifest URLs passed status,
  non-HTML asset and deployed-hash checks. Restricted-role read-only checks
  covered 3 cemeteries, 3 grave details, 2 headstone details, 6 record-option
  queries and 3 searches.
- Public `/request-access` returned 200; origin anonymous private API requests
  returned 401; public `/api/me` redirected to Cloudflare Access with 302.
  Auth0, required Turnstile, TEST hostname validation and trusted loopback proxy
  settings remained enabled. Missing/forged token POSTs returned application
  403 errors and created **zero** access-request records.
- Unchanged burst protection/cooldown passed: 12 bounded GET probes returned
  4×404 and 8×429, with **6** identified Cloudflare rate-limit pages. After 15
  seconds a new GET returned normal 404 without a rate-limit page. GET probes
  cannot create access requests; this does not promise an exact global cutoff.

Fresh live Access/Auth0 login, invitation delivery, token replay, disconnected
offline reload/save/reconnect synchronization and a fresh real Turnstile-backed
submission remain **pending**. Read-only ranking and public metadata checks do
not close those gaps. Historical records retain their original scope; this
release does not establish STAGE/PROD deployment.

### v0.2.4 recovery material

- Backup: `/srv/nhcemeteries/backups/20261110T165725Z-880650634483-8fd322f7`.
- Release report:
  `/srv/nhcemeteries/staging/20261110T165725Z-880650634483-8fd322f7/verification.json`.
- Supplemental preservation/asset/security/identity report:
  `/srv/nhcemeteries/staging/20261110T165725Z-880650634483-8fd322f7/smoke-verification.json`.
- E-0567 first-position/unconfirmed evidence:
  `/srv/nhcemeteries/staging/20261110T165725Z-880650634483-8fd322f7/reading-match-verification.json`.
- Browser metadata evidence:
  `/srv/nhcemeteries/staging/20261110T165725Z-880650634483-8fd322f7/browser-metadata-verification.json`.

Deployed API image:
`sha256:5fcf80240b28c780b30e8a1bb3fb3475573caaafbb566fa4e552f1f417c36a8e`.
Retain recovery material outside Git. Code rollback does not roll back schema/
data; later documentation-only merges do not change the deployed tag.
