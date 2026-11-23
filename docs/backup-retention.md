---
---

# Hosted TEST encrypted backups and retention

For the latest live audit and isolated logical recovery results, see
[November 20 verification](#november-20-2026-schedule-retention-and-isolated-restore-verification).

Decision, November 13, 2026: use a private DigitalOcean Spaces **Standard** bucket
in SFO3, with CDN disabled and restricted listing. The actual bucket identifier
and ownership/access inventory are recorded in the private operations repository.
The TEST Droplet is in NYC1. Spaces is separate from the server and region, but
remains exposed to the same DigitalOcean account's access and billing failures.
The November 13 setup record quoted $5/month including 250 GiB storage; this
reconciliation does not revalidate billing. Check invoices and
[current pricing](https://docs.digitalocean.com/products/spaces/details/pricing/).
Daily provider Droplet backups supplement this logical recovery workflow.

See the [service inventory and backup/recovery diagram](service-architecture.md#backups-and-recovery)
for the relationship between provider backups, local recovery material, encrypted
object storage and independent credentials. Reconciled November 17, 2026 from
committed tooling and the November 13 records; no new live audit or restore was
performed for this documentation update.

## Secrets and installation

The bucket key is limited to Read/Write/Delete on this bucket. It cannot administer
other DigitalOcean resources. Restic encrypts backup content and metadata before
upload. Keep the repository password separately: neither DigitalOcean nor restic
can recover an encrypted repository after that password is lost.

Root-owned mode-0600 `/etc/nhcemeteries-backup.env` follows
`deploy/test/backup.env.example`. The repository password is a separate mode-0600
file under `/etc/nhcemeteries-backup/`. Never commit secrets or publish protected
command logs, manifests, raw records, or recovery files.

Recovery credentials and the independent restic password were saved in the
operator's password vault on November 13, 2026. Retrieval matched the source
files by checksum/size before the temporary Mac secret copies were removed.
This proves the recorded retrieval, not access by a future successor. Consult
the private operations repository for the vault item, attachment names and
recovery access; no secret values belong in either repository.

Keep the independently held recovery copy current when credentials change.
Rotating a Spaces access key does not change the restic encryption password.
The vault is an operator recovery dependency, not a runtime API integration.

The server files `/etc/nhcemeteries-backup.env` and
`/etc/nhcemeteries-backup/repository-password` were verified to match the
originals, remain root-owned with mode 0600, and were preserved for scheduled
backups. Backup freshness and disk status were healthy, and cron remained active.

From the reviewed revision, install the official checksum-pinned binary and both
scripts (Python 3.12 or later):

```sh
python3 deploy/test/install_restic.py /usr/local/bin
install -m 0755 deploy/test/backup_retention.py /usr/local/sbin/nhcemeteries-test-backup-retention
install -m 0755 deploy/test/backup.sh /usr/local/sbin/nhcemeteries-test-backup
```

Preserve the previous installed script before replacement. Initialize the empty
remote repository once with `nhcemeteries-test-backup-retention init`. Do not
initialize a different repository when credentials or connectivity fail.
All commands take the deployment lock; a concurrent deployment or backup causes
them to stop instead of racing. External restore clients also hold repository
locks: finish those restores before integrity checks or pruning, and allow the
client to release its live lock normally. No application release or database migration is
required to install this tooling.

## Verification before deletion

The daily command creates a custom-format database dump, validates its table of
contents with `pg_restore --list`, and saves database roles with `pg_dumpall`.
It snapshots application files/settings, media, daily dumps, and existing
retention holds/verification evidence with restic.
It checks repository structure, streams decrypted content back without extracting
large archives locally, compares every file's SHA-256 and size, and rehashes the
local sources. Changes or failures stop pruning. A listing check is not a database
restore test; rehearse a full restore separately.

Local recovery cleanup is explicit and reviewable:

```sh
nhcemeteries-test-backup-retention plan
nhcemeteries-test-backup-retention archive
nhcemeteries-test-backup-retention apply
```

The private plan identifies exact sources and estimates reclaimable blocks,
accounting for hard links. `archive` uploads those sources under a recovery-hold
tag and verifies decrypted readback. `apply` requires a matching proof less than
24 hours old, the same repository and available immutable snapshot, unchanged
local files, and continued eligibility. `maintain` runs these steps together.
Never bypass these checks to obtain space. Recreate and reverify a plan if files
change. Store private audit results under `/srv/nhcemeteries/backup-retention/`.

## Retention policy

- Daily local dumps: 14 days, conditional on verified offsite coverage.
- Offsite daily snapshots: 30 daily, 8 weekly, 6 monthly. `expire` is a dry run;
  `expire --apply` applies this policy. Grouping is by host and tags so changing
  dump filenames do not prevent expiration.
- Keep the latest four successfully verified deployment recovery sets locally.
  Older successful backups become eligible after 14 days; their staging files
  after 7 days. Successful verification evidence is saved privately before
  staging removal so the paired backup remains eligible at 14 days. Unknown or
  failed releases remain for manual review.
- Three reviewed legacy sets are eligible: `release-20261017-f927266`,
  `release-20261017-38eb15e`, and `security-20260925T172451Z`. Their estimated
  exclusive allocation was 16.9 GiB during the November 12 investigation.
- Migration/import/manual checkpoints remain held. In particular retain
  `pg18-20261105T151427Z` until its recovery requirement is explicitly retired.
- Pool media archives become eligible only after 14 days, with no release
  inventory reference and no remaining hard links outside the pool file itself.
- Archived recovery-hold snapshots do not automatically expire. Review holds
  explicitly; offsite capacity may therefore grow beyond daily retention.

Optional explicit holds in the private policy file:

```json
{"holds":["backups/pg18-20261105T151427Z"]}
```

A named release hold protects its staging counterpart too. Live media, app files,
database volumes, unknown backup directories, symlinks, and Docker images are never
cleanup roots. Keep current and compatible rollback images; assess image removal
separately against retained source/settings and recovery sets. Do not run blanket
`docker system prune -a --volumes`.

## Schedule, monitoring, and recovery

Set the explicit PATH from `backup-retention.cron.example`; cron otherwise may
not find restic in `/usr/local/bin`. Keep the existing daily 03:30 UTC cron
without duplication. After the initial
verified backup and cleanup, use `backup-retention.cron.example` for weekly
maintenance and offsite expiration, and monthly full repository readback.
`status` reports verified daily backup freshness and disk thresholds: warn below
15 GiB free, critical below 10 GiB or when offsite daily verification exceeds
26 hours. Aim for at least 20 GiB free. Monitor job failures and protected logs;
these scripts do not themselves deliver alerts. Rotate `commands.log` and inspect
restic cache growth. Never treat a fresh local dump as a verified remote backup.

Monthly, also restore a selected dump to a disposable PostgreSQL/PostGIS instance.
Wait for the container entrypoint to finish initialization, not merely for its
temporary initialization server to accept connections. Create a separate empty
database with `createdb --template=template0` and restore there; the image's
automatically created database already contains PostGIS/tiger schemas and can
conflict with a full dump. Use `pg_restore --exit-on-error --no-owner
--no-privileges` after creating required roles in the isolated cluster.
Verify schema, representative business rows, roles, media references, and
application health. Recover settings/media into private isolated paths, then run
the normal application verification. Restore testing must not overwrite live TEST.
Use the independent password copy and bucket credentials to prove recovery can
start without access to the original Droplet. Restic `check --read-data` validates
all stored data but does not replace this application-level restore rehearsal.

References: [restic backup](https://restic.readthedocs.io/en/stable/040_backup.html),
[restore](https://restic.readthedocs.io/en/stable/050_restore.html),
[retention](https://restic.readthedocs.io/en/stable/060_forget.html), and
[PostgreSQL logical backups](https://www.postgresql.org/docs/current/backup-dump.html).

## November 13, 2026 setup and recovery verification

The private Standard bucket and a bucket-scoped Read/Write/Delete key were
created with operator authorization. Anonymous requests to both bucket listing
and the repository configuration returned HTTP 403. The password and credentials
were installed privately on TEST, with a separate mode-0600 recovery copy on the
operator's Mac. Independent repository decryption from that Mac passed.

The initial recovery-hold snapshot `cf2dcfb853799302a06e23e9c9e3dcfda25381655fe21da43fc800515524ad13`
contains application/settings, live media, existing daily dumps, and the held
PostgreSQL upgrade checkpoint: 2,605 files, 14,255,989,143 source bytes.
A complete `restic check --read-data` passed. A broader initial scan was stopped
safely after identifying repeated hard-linked paths; it did not delete local
files. Any unreferenced uploaded packs can be reclaimed by normal restic pruning.

The dump in rehearsal snapshot `d868b0be5ab180dc7394c7881dce891be6436142037c0b8e941d9eef46057a17`
was downloaded from Spaces, matched its source SHA-256, and restored successfully
to an isolated PostgreSQL 18.6/PostGIS 3.6.4 container using the production image
digest. It contained **566 headstones, 809 gravesites, 755 media assets, and 519
migration records**. Early rehearsal attempts exposed initialization and prefilled
schema conflicts in the test harness; the successful rehearsal used the empty
`template0` database procedure above. Temporary rehearsal containers and data
were removed, leaving live TEST unchanged. Private logs and the restore report
remain under `/srv/nhcemeteries/backup-retention/`.

The implementation and explicit checksum-hold safeguard were merged after all
required CI passed in [PR 859](https://github.com/scpeterson/CemeteryMapping/pull/859)
and [PR 860](https://github.com/scpeterson/CemeteryMapping/pull/860).

The initial cleanup manifest selected 16 backup/staging roots containing 5,005
files and 38,415,671,283 logical bytes, with an estimated 18,297,073,664 bytes
(17.04 GiB) reclaimable after accounting for external hard links. Recovery-hold
snapshot `cfb4c8e178422acd2e1e4d97362deee518323937df23372cd86b7d8136bab83f`
passed repository structure checks, complete decrypted file readback against
SHA-256/size records, and a subsequent comparison with the unchanged local
sources before cleanup proof was issued.

[PR 861](https://github.com/scpeterson/CemeteryMapping/pull/861) completed the cron
environment, persistent release-verification evidence, and recovery procedure.
All required CI passed before the merged safeguards were installed. CI bundle
measurements use fixed test metadata for reproducibility; the core budget and
MapLibre growth policy remain unchanged, and release builds use real metadata.

After the proof passed a final snapshot/hold/source check, the 16 selected roots
were removed. The root filesystem changed from **97% used with about 2.9 GiB
free to 74% used with about 20 GiB free**. The latest four verified deployment
recovery sets and the PostgreSQL upgrade checkpoint remained. Six older retained
release sets kept private successful-verification evidence after staging removal.
Live application/media files, Docker images, and database volumes were preserved.

A fresh daily snapshot `418e2d1a2c14270175fcc44cd44fc64d01f07ae8a9a397ea68a601a1d8a5c191`
then passed complete decrypted readback with the explicit cron environment.
Offsite expiration passed its dry run, was applied, and passed the subsequent
repository check. Recovery-hold snapshots remained available. Initial cleanup
inputs are preserved as `initial-cleanup-manifest.json` and
`initial-cleanup-proof.json`; `implementation.json` records the installed script
hash, source revision, enabled schedules, and healthy disk/freshness status.

The existing cron file now contains one daily backup at 03:30 UTC, weekly local
retention Sundays at 05:30 UTC, weekly offsite expiration at 06:30 UTC, monthly
full-data checks on day 1 at 07:30 UTC, and hourly status logging at minute 17.
Cron was active after installation. Job output is protected in `scheduler.log`;
status JSON is logged with tag `nhcemeteries-backup-status`. Protected command and
scheduler logs rotate weekly or at 10 MiB, retaining eight compressed rotations.
Both disk warning and critical flags were false after setup.

## November 20, 2026 schedule, retention and isolated restore verification

The existing cron service was active in UTC, with exactly one daily backup job.
The configured jobs remain daily backup at 03:30 UTC, Sunday local retention at
05:30 UTC, Sunday offsite expiration at 06:30 UTC, full repository readback on
day 1 at 07:30 UTC, and hourly status logging at minute 17. Log rotation retains
eight protected rotations. Installed backup-manager source matched the reviewed
repository SHA-256; credential files remained root-owned and mode 0600.

The latest verified daily snapshot was created November 20 at 03:30:59 UTC
(November 19 at 10:30:59 p.m. EST). Its completed verification was about 14 hours
old during this review, within the 26-hour limit. All seven scheduled daily runs
from November 14–20 had corresponding offsite snapshots. Nine daily snapshots and four
recovery-hold snapshots were present. Anonymous bucket listing and repository
configuration requests returned 403. The 30-daily/8-weekly/6-monthly policy passed
its dry run; the repository is too new to contain that full historical depth.
Local retention planning preserved the latest four verified release sets and the
explicit PostgreSQL upgrade hold. Fifteen eligible roots represented about
207 MiB of reclaimable allocation. No local cleanup or offsite expiration was
applied, and no backups were deleted.

A full repository `check --read-data` passed in 518 seconds. All 13 snapshot IDs
matched before and after the check. An interrupted serial download had left a
stale reader lock; its process was confirmed absent and the default liveness-checked
`unlock` cleared the stale lock before the successful check. No forced removal of
active locks, repair, prune or snapshot deletion ran during this review.

Recovery ran on the operator's Mac, keeping large restored files off TEST's
filesystem. A checksum-pinned restic client directly downloaded and decrypted the
latest daily snapshot, recovering 2,574 files (7,483,230,440 bytes), including
application source, deployment settings, media, database dumps and roles. The
2,548 application/media/latest-dump files compared with their TEST sources all
matched SHA-256 and size. Temporary repository access-key/password copies used
for direct Mac access were removed after the attempt. Restored copies remain in
a private local rehearsal directory; original local and offsite backups remain.

The latest dump and globals restored without errors into a separate PostgreSQL
18.6 cluster, using an empty `template0` database. All 90 restored application
table fingerprints matched current TEST, including accounts and policy history.
The schema includes migration 522; PostGIS/topology are 3.7.0 and legacy TIGER
is 3.6.4. Counts include 566 markers, 809 gravesites, 713 burials and 755 media
assets. All 755 stored media references resolved to recovered files with matching
recorded sizes where available.

An unpublished API image built from the recovered source ran as its normal Node
user against the isolated database and recovered media. Database-backed health
reported the original v0.3.0/f08cc59 build; Auth0 mode denied anonymous map access.
A separate disposable, internal-only disabled-auth smoke session loaded 784 active
graves, 566 markers and a photo whose response matched its recovered SHA-256.
There were no published container ports or connections to live TEST from the
restored application. The temporary containers, database volume, network and API
image were removed.

Final live comparison matched all 90 table fingerprints and confirmed unchanged
API version/start time, healthy TEST, and no removed or altered files among
66,484 pre-existing backup files (size/timestamp comparison). No deployment,
live migration, account edit, policy save or service restart ran. Private audit,
retention and preservation reports remain with the operator's recovery evidence.

Capacity remains a follow-up: approximately **14.6 GiB free**, below the **15 GiB
warning** threshold, above the **10 GiB critical** threshold and short of the
**20 GiB target**. Hourly logs correctly reported warning=true/critical=false.
The scripts log failures/status but do not deliver alerts. Removing the currently
eligible 207 MiB alone would not resolve the capacity warning; no removal was
authorized or performed in this review.

This establishes logical database/media/settings recovery, not full host
replacement, provider Droplet-snapshot recovery or public tunnel/login recovery.
Direct Mac access used temporary copies of the server credentials; independent
password-vault retrieval was not repeated. The November 13 escrow evidence retains
its original scope. Keep these distinctions when assessing total-host-loss
readiness.
