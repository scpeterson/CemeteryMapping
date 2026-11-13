#!/bin/sh
set -eu
umask 077
# This manager always creates a local logical dump before attempting offsite backup.
# Missing/failed remote verification stops retention; no unverified dumps are pruned.
exec /usr/local/sbin/nhcemeteries-test-backup-retention daily
