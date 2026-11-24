---
---

# DEV and TEST consistency

[Documentation home](index.md) · [Hosted TEST](hosted-test.md) · [Rebuild guide](rebuild.md)

DEV is authoritative for reviewed business-data refreshes. Local TEST and hosted
TEST retain their own users, access settings, authentication clients, secrets,
activity, field-operation receipts and audit/system history. Equal business data
does not mean copying entire databases over another environment.

## Managed local services

Use Node **24.22.3** (`.nvmrc`) and lockfile-installed dependencies. Both local
databases use `cemeterymapping-postgis:18-3.7-tiger3.6.4`, built from digest-pinned
bases. Preserve existing named volumes when recreating containers; never use
`down -v`. See [PostgreSQL recovery](postgresql-18-upgrade.md).

| Service | DEV | Local TEST |
| --- | --- | --- |
| Browser | `http://127.0.0.1:5173` | `http://127.0.0.1:5174` |
| API | `http://127.0.0.1:3001` | `http://127.0.0.1:3003` |
| Database port | `db/env/dev.local.env` override; currently 5436 | 5433 |
| Runtime profile | `.runtime/dev/environment.json` | `.runtime/test/environment.json` |
| Frontend | Vite development server | Isolated production-mode preview built in TEST mode |

Create each ignored private runtime profile with mode **0600**, and protect its
parent directory with mode **0700**. The profile contains explicit `AUTH_MODE`,
`AUTH0_DOMAIN`, `AUTH0_AUDIENCE`, plus any existing API-only configuration such as
management credentials, Turnstile or `MEDIA_UPLOAD_DIR`. Keep the original values;
do not copy DEV secrets to TEST. Database configuration continues to come from
`db/env/<environment>.env` and its ignored `.local.env` override. The checked-in
runner refuses profiles without Auth0. Public frontend configuration continues
to come from `.env.dev.local` / `.env.test.local`.

```json
{
  "AUTH_MODE": "auth0",
  "AUTH0_DOMAIN": "your-environment.us.auth0.com",
  "AUTH0_AUDIENCE": "your-environment-api-audience"
}
```

On macOS:

```bash
npm run local:runtime -- build dev
npm run local:runtime -- start dev
npm run local:runtime -- status dev
npm run local:runtime -- build test
npm run local:runtime -- start test
npm run local:runtime -- status test
```

`start` installs a checkout-specific LaunchAgent and starts it immediately. It
runs at login and restarts a failed API/frontend pair. `stop dev|test` unloads the
agent; it does not remove data or builds. Stop pre-existing temporary services by
verified ownership before the first start. The runner refuses occupied ports and
does not kill their owners. Private logs are `.runtime/<environment>/runtime.log`.
On other platforms, run `npm run local:runtime -- run test` under the platform's
service manager; automatic service installation is macOS-only.

A TEST build captures API/shared source and frontend assets together in a new
`.runtime/test/releases/<timestamp>` directory. It does not serve root `dist`.
The API snapshot uses the checkout's lockfile-installed `node_modules`; after
`npm ci` or a dependency change, rebuild/restart TEST. DEV intentionally serves
working-tree source with HMR. Build metadata records HEAD and build time, so
commit application edits before preparing a release. After a build, stop/start
the affected runtime to activate it; `status` rejects an older running release.
The older TEST release directories remain available for reviewed rollback.

Local DEV and TEST currently share the local media directory. They have separate
databases and users; a local TEST upload changes shared disk contents. Use a
separate `MEDIA_UPLOAD_DIR` populated from a verified copy when testing media
mutations, or test with a disposable database/media copy. Hosted media is separate.

## Read-only parity verification

Create ignored `.runtime/environments.json` with these three target names. Paths
and the SSH destination are operator configuration, not secrets to check in.
The remote requires Python 3.11 or newer, Docker and authorized database access.

```json
{
  "dev": {
    "container": "cemetery-mapping-db-dev",
    "database": "cemetery_mapping_dev",
    "url": "http://127.0.0.1:5173",
    "source": "/absolute/checkout",
    "media": "/absolute/checkout/uploads/media"
  },
  "local-test": {
    "container": "cemetery-mapping-db-test",
    "database": "cemetery_mapping_test",
    "url": "http://127.0.0.1:5174",
    "source": "/absolute/checkout",
    "media": "/absolute/checkout/uploads/media"
  },
  "hosted-test": {
    "container": "nhcemeteries-test-db-1",
    "database": "cemetery_mapping_test",
    "url": "http://127.0.0.1:8080",
    "source": "/srv/nhcemeteries/app",
    "media": "/srv/nhcemeteries/media",
    "ssh": ["ssh", "-i", "/absolute/private-key", "-o", "BatchMode=yes", "operator@host"]
  }
}
```

```bash
npm run verify:environments -- --output db/backups/parity-YYYYMMDDTHHMMSS
```

The output directory must be new and under ignored `db/backups`; reports are
private. Exit **0** means the compared scopes match; **1** means drift; **2** means
the audit could not finish. The audit cannot change databases or media. Each
SQL snapshot uses a read-only repeatable-read transaction. Geometry/geography
columns include EWKB bytes, and all business rows include deleted history.
Media checks compare relative names, sizes and SHA-256, rejecting symlinks.
Source checks compare `src`, `server`, `shared`, `public` and dependency/runtime
package configuration; operator npm scripts and release metadata are separate.
This is source parity, not a replacement for the hosted deployment manifest or
verification of the running TEST API snapshot against its build manifest.

Reports exclude these environment-specific tables from business row equality:
`app_users`, `app_user_activity`, `app_user_cemetery_access`, `access_requests`,
`field_operations`, `audit_events`, `system_events`, `databasechangelog`,
`databasechangeloglock`, `app_roles`, `audit_retention_policies` and
`system_event_retention_policies`. Extension catalog `spatial_ref_sys` is not a
business sync target. Column definitions, public functions and extension versions
are compared separately. Migration ledger checksums/history must be reviewed via
Liquibase validation/status, not overwritten to force equality.

Hosted origin health and anonymous `/api/me` rejection run over authorized SSH.
Public HTTPS/Cloudflare Access and a fresh Auth0 login are separate browser
checks. Different build timestamps are expected; verify that revision IDs and
release manifests describe the intended release. Quiesce writers for a decisive
comparison; snapshots across three databases are not one global transaction.

## Controlled DEV-to-TEST refresh

1. Record exact application revisions, schema status, extension versions, media
   roots and the read-only parity report. Stop if schema/code are incompatible.
   Review target-only changes with their owner; never assume they are disposable.
2. Quiesce writes. Back up **each** database, globals/roles, private configuration
   and media before changing anything. Protect files and verify archive checksums
   and dump readability. Take a cold volume copy before container/database work.
   Check free space and an independent recoverable copy first; see
   [backup retention](backup-retention.md).
3. Produce a reviewed plan for the 78 business tables from DEV. Preserve complete
   UUIDs, timestamps, soft-deleted history, JSON numeric values and geometry EWKB.
   Exclude the tables above. Check every referenced user exists in the target;
   stop for explicit identity mapping rather than creating or overwriting users.
   Preserve TEST audit history and append normal sync audit evidence.
4. Restore source and target backups into disposable databases and media roots.
   Rehearse the exact plan there first, including dependency order, natural-key
   collisions, foreign keys, check constraints, rollback and post-apply parity.
   Keep business/audit rules active; any exceptional trigger handling requires a
   separately reviewed plan that restores every trigger and validates constraints
   before commit. Do not run a full DEV restore over live TEST.
5. Apply only the reviewed source/target plan with precondition fingerprints and
   transaction protection. Abort if either side changed since review. Copy media
   by verified content; quarantine target-only files with recovery evidence rather
   than deleting them. Verify a complete second readback and all referenced files.
6. Re-run parity, verify users/access/configuration unchanged, check API health,
   anonymous denial and authenticated workflows. Preserve private evidence and
   recovery copies. Resume writers only after verification. Record the operation
   in the deployment documentation; do not publish raw dumps or account details.

The November 23 sync was rehearsed and verified separately. This procedure does
not authorize periodic destructive refreshes or implement an unattended live-data
replacement command.

## Workflow verification and intentional differences

Verify fresh Auth0 sign-in, reader/power-user/admin permissions with existing
appropriately scoped accounts, photo upload/readback on disposable fixtures, and
online/offline field queue/reconnect behavior. Do not widen real users' access to
make a test pass. Isolated browser/database tests provide regression coverage;
they do not establish fresh sign-in or physical-phone behavior. The user deferred
the physical phone offline observation/photo/reconnect test on November 24, 2026.
Track that check explicitly until performed.

Use the same identity provider as the existing application-user mapping. A Google
identity and a password identity with the same email have different Auth0
subjects. An authenticated but unmapped identity must remain denied; do not grant
it access or relink users merely to make smoke verification pass.

Environment-specific users, secrets, Auth0 client IDs, ports, media roots,
audit/system history and runtime supervision settings are expected differences.
Historical databases retain their original extensions until separately migrated;
version parity applies to the three active application databases.

Built-browser fixture smoke checks can be repeated without touching live data:

```bash
FIELD_BUILD=1 npx playwright test --config playwright.environment-smoke.config.ts
```

This starts an isolated preview on port 5198, builds into
`.runtime/workflow-smoke/dist`, and directs any unmocked API request to a closed
loopback port. It includes real browser offline/reload/service-worker behavior,
photo upload/readback/retry fixtures and reader restrictions. It does not replace
live Auth0 sessions or the deferred physical-phone test.
