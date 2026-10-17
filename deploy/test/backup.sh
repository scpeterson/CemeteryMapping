#!/bin/sh
set -eu
umask 077
cd /srv/nhcemeteries/app/deploy/test
backup_dir=/srv/nhcemeteries/backups
mkdir -p "$backup_dir"
backup_file="$backup_dir/test-$(date -u +%Y%m%dT%H%M%SZ).dump"
trap 'rm -f "$backup_file.partial"' EXIT HUP INT TERM
docker compose exec -T db pg_dump -U cemetery_app -d cemetery_mapping_test \
  --format=custom --no-owner --no-privileges > "$backup_file.partial"
docker compose exec -T db pg_restore --list < "$backup_file.partial" > /dev/null
mv "$backup_file.partial" "$backup_file"
# Only prune dumps created by this job. Preserve the initial deployment snapshot.
find "$backup_dir" -type f -name 'test-*.dump' -mtime +14 -delete
