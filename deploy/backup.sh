#!/usr/bin/env bash
# Daily backup of the database and uploads, kept 14 days in /var/backups/mediane.
# Installed as a root cron job (see docs/DEPLOYMENT_VERCEL_VPS.md). Copy the
# folder off the VPS from time to time: a backup on the same disk is not enough.
set -Eeuo pipefail
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
DEST=/var/backups/mediane
STAMP=$(date -u +%Y%m%dT%H%MZ)
umask 077
mkdir -p "$DEST"
cd "$ROOT"
docker compose --env-file .env -f compose.prod.yaml exec -T postgres \
  pg_dump -U cabinguard -d cabinguard -Fc > "$DEST/db-$STAMP.dump"
docker run --rm -v cabinguard_uploads:/data:ro busybox:1.37 tar -czf - -C /data . \
  > "$DEST/uploads-$STAMP.tgz"
find "$DEST" -type f -mtime +14 -delete
