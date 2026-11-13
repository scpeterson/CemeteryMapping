---
---

# Hosted TEST encrypted backups and retention

Decision, November 13, 2026: use a private DigitalOcean Spaces **Standard** bucket,
`nhcemeteries-test-backups` in SFO3, with CDN disabled and restricted listing.
The TEST Droplet is in NYC1. Spaces is separate from the server and region, but
remains exposed to the same DigitalOcean account's access and billing failures.
The subscription is $5/month including 250 GiB storage; verify
[current pricing](https://docs.digitalocean.com/products/spaces/details/pricing/).
Daily provider Droplet backups supplement this logical recovery workflow.

## Secrets and installation

The bucket key is limited to Read/Write/Delete on this bucket. It cannot administer
other DigitalOcean resources. Restic encrypts backup content and metadata before
upload. Keep the repository password separately: neither DigitalOcean nor restic
can recover an encrypted repository after that password is lost.

Root-owned mode-0600 `/etc/nhcemeteries-backup.env` follows
`deploy/test/backup.env.example`. The repository password is a separate mode-0600
file under `/etc/nhcemeteries-backup/`. Never commit secrets or publish protected
command logs, manifests, raw records, or recovery files. A separate recovery copy
is kept on the operator's Mac in `~/.config/nhcemeteries-backup/`; copy its files
into the operator's password manager or another independently protected recovery
location. Backing up this Mac is necessary until that transfer is completed.

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
them to stop instead of racing. No application release or database migration is
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
