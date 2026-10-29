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
Include the `shared/` source directory in the release archive alongside `server/`.
The API imports shared normalization modules at runtime; the Dockerfile and its
allowlist in `deploy/test/Dockerfile.dockerignore` must both include `shared/`.
Missing shared modules can prevent the API from starting.

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
npm run deploy:test
```

This is an on-demand release command for the existing hosted TEST host only.
It fetches `origin/main`, requires the exact commit's **Lint, build, and test**
check to have passed, and builds that revision from a clean Git archive. Local
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
- Watch Nginx 429 counts and Turnstile Analytics. API visitor/global rate buckets
  reset on process restart; database capacity limits survive restart. Do not
  restart services to evade limits or create a database log/email per rejection.
- A 403 verification failure can mean a missing/expired/invalid token, wrong secret,
  action/hostname mismatch, or failed outbound Siteverify call. Check configuration
  and connectivity without logging secrets or tokens; preserve fail-closed behavior.
- A 429 can originate at Nginx, the API attempt limiter, database lock contention,
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

The new API requires schema changeset `502-passageway-area-type`. Verify startup
and health after the separately authorized release, then confirm ten passageways,
individual gravesite deed support, blocked whole-passageway ownership and the
C-P03 expansion. Confirm all fixed monuments, existing grave/ownership assignments
and E/G gravesite-only behavior remain intact. Preserve the hosted deployment
record separately from the dated DEV evidence.

## CI validation paths

CI runs quick checks, serial database integration tests and four isolated browser
shards in parallel. Recognized documentation-only PRs build and validate the docs;
every main push still runs application validation. The required
`Lint, build, and test` aggregate remains the hosted deployment gate. See
[ADR 0181](adr/0181-parallel-ci.md) for classification, caches, isolation and recovery.
