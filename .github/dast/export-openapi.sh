#!/usr/bin/env bash
# Exports the API's OpenAPI document for the scanner.
#
# The scanned container runs in production mode, where Swagger is refused by
# design. So the document comes from the same commit, booted briefly in
# development mode (Swagger on) against the DAST database, then stopped.
#
#   .github/dast/export-openapi.sh <output.json>
#
# Expects backend/ to be installed and built (npm ci && npm run build), and
# DATABASE_URL to point at a migrated database.
set -euo pipefail

out="${1:?usage: export-openapi.sh <output.json>}"
out="$(cd "$(dirname "$out")" && pwd)/$(basename "$out")"
port="${OPENAPI_EXPORT_PORT:-4999}"
log="$(mktemp)"

cd "$(dirname "$0")/../../backend"

NODE_ENV=development SWAGGER_ENABLED=true PORT="$port" LOG_LEVEL=warn \
  CORS_ORIGINS=http://localhost FRONTEND_URL=http://localhost COOKIE_SECURE=false \
  STORAGE_DRIVER=local STORAGE_LOCAL_DIR="$(mktemp -d)" SAFETY_WORKER_ENABLED=false \
  MAIL_HOST=127.0.0.1 MAIL_FROM="CabinGuard <no-reply@cabinguard.dast>" \
  node dist/main.js >"$log" 2>&1 &
pid=$!
trap 'kill "$pid" 2>/dev/null || true; rm -f "$log"' EXIT

for _ in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:${port}/api/docs-json" -o "$out" 2>/dev/null; then
    echo "OpenAPI document written to $out ($(wc -c <"$out") bytes)"
    exit 0
  fi
  if ! kill -0 "$pid" 2>/dev/null; then
    echo "::error::the API exited before serving its OpenAPI document" >&2
    cat "$log" >&2
    exit 1
  fi
  sleep 1
done
echo "::error::timed out waiting for /api/docs-json" >&2
cat "$log" >&2
exit 1
