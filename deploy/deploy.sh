#!/usr/bin/env bash
# Deploys one release of CabinGuard on the VM. Run as root by Azure run-command
# from .github/workflows/deploy.yml; every input arrives as an environment
# variable (the secret ones as protected parameters, never logged by Azure).
#
#   BUNDLE_B64     tar.gz of deploy/ (compose file, Caddyfile), base64
#   ENV_B64        the application .env, base64
#   RELEASE        version label, e.g. sha-1a2b3c4
#   BACKEND_IMAGE  MIGRATE_IMAGE  WEB_IMAGE   image@sha256:digest
#   APP_DOMAIN     API_DOMAIN
#   GHCR_USER      GHCR_TOKEN   short-lived token of the deploy job (pull only)
#
# Order: files, pull, migrate, start, health check. If the new release is not
# healthy, the previous one is started again and the run fails.
# Run Command may start the script with sh: switch to bash first.
if [ -z "${BASH_VERSION:-}" ]; then exec bash "$0" "$@"; fi
set -Eeuo pipefail
umask 077

ROOT=/opt/cabinguard
COMPOSE=(docker compose --project-directory "$ROOT" -f "$ROOT/compose.prod.yaml" --env-file "$ROOT/release.env")

log() { printf '[deploy %s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }

for name in BUNDLE_B64 ENV_B64 RELEASE BACKEND_IMAGE MIGRATE_IMAGE WEB_IMAGE APP_DOMAIN API_DOMAIN GHCR_USER GHCR_TOKEN; do
  [ -n "${!name:-}" ] || { log "missing input: $name"; exit 2; }
done
for ref in "$BACKEND_IMAGE" "$MIGRATE_IMAGE" "$WEB_IMAGE"; do
  [[ "$ref" == *@sha256:* ]] || { log "image not pinned by digest: $ref"; exit 2; }
done

# The registry credential lives only for this run.
export DOCKER_CONFIG
DOCKER_CONFIG="$(mktemp -d)"
trap 'rm -rf "$DOCKER_CONFIG"' EXIT

install -d -m 700 "$ROOT"
cd "$ROOT"

# 1. Files: stack definition, configuration, release pins.
log "release $RELEASE"
base64 -d <<<"$BUNDLE_B64" | tar -xzf - -C "$ROOT" compose.prod.yaml Caddyfile
base64 -d <<<"$ENV_B64" >"$ROOT/.env.next"
chmod 600 "$ROOT/.env.next"
cat >"$ROOT/release.next.env" <<EOF
RELEASE=$RELEASE
BACKEND_IMAGE=$BACKEND_IMAGE
MIGRATE_IMAGE=$MIGRATE_IMAGE
WEB_IMAGE=$WEB_IMAGE
APP_DOMAIN=$APP_DOMAIN
API_DOMAIN=$API_DOMAIN
POSTGRES_PASSWORD=$(grep -E '^POSTGRES_PASSWORD=' "$ROOT/.env.next" | cut -d= -f2-)
EOF
chmod 600 "$ROOT/release.next.env"

[ -f "$ROOT/release.env" ] && cp -p "$ROOT/release.env" "$ROOT/release.prev.env"
[ -f "$ROOT/.env" ] && cp -p "$ROOT/.env" "$ROOT/.env.prev"
mv "$ROOT/.env.next" "$ROOT/.env"
mv "$ROOT/release.next.env" "$ROOT/release.env"

rollback() {
  log "release $RELEASE is NOT healthy"
  "${COMPOSE[@]}" ps || true
  "${COMPOSE[@]}" logs --no-color --tail 60 api web caddy || true
  if [ -f "$ROOT/release.prev.env" ]; then
    log "rolling back to $(grep '^RELEASE=' "$ROOT/release.prev.env" | cut -d= -f2)"
    mv "$ROOT/release.prev.env" "$ROOT/release.env"
    [ -f "$ROOT/.env.prev" ] && mv "$ROOT/.env.prev" "$ROOT/.env"
    "${COMPOSE[@]}" up -d --remove-orphans --wait --wait-timeout 180 || true
  else
    log "first release: nothing to roll back to"
  fi
  exit 1
}

# 2. Images, by digest.
log "pulling images"
printf '%s' "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USER" --password-stdin >/dev/null
"${COMPOSE[@]}" --profile migrate pull --quiet

# 3. Database first, then the migrations of this release (forward only).
log "migrating the database"
"${COMPOSE[@]}" up -d --wait --wait-timeout 120 postgres
"${COMPOSE[@]}" --profile migrate run --rm migrate || rollback

# 4. Application: replaced containers come up and must report healthy.
log "starting the application"
"${COMPOSE[@]}" up -d --remove-orphans --wait --wait-timeout 300 api web caddy || rollback

# 5. End to end through Caddy and TLS, as a visitor would.
log "health check through HTTPS"
healthy=false
for _ in $(seq 1 30); do
  if curl -fsS --max-time 5 --resolve "$API_DOMAIN:443:127.0.0.1" "https://$API_DOMAIN/api/v1/health" >/dev/null \
    && curl -fsS --max-time 5 --resolve "$APP_DOMAIN:443:127.0.0.1" "https://$APP_DOMAIN/sign-in" >/dev/null; then
    healthy=true
    break
  fi
  sleep 5
done
[ "$healthy" = true ] || rollback

rm -f "$ROOT/release.prev.env" "$ROOT/.env.prev"
# Keep recent images for a manual rollback; drop the rest.
docker image prune -af --filter "until=336h" >/dev/null || true
log "release $RELEASE is live: https://$APP_DOMAIN and https://$API_DOMAIN"
"${COMPOSE[@]}" ps --format 'table {{.Service}}\t{{.Status}}'
