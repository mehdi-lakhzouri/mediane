#!/usr/bin/env bash
# Deploy the backend to the VPS over an operator's SSH session.
# Configuration and registry credentials stay on the server, outside Git.
set -Eeuo pipefail
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"
[ -f .env ] || { echo "Create deploy/.env from production.env.example first." >&2; exit 2; }
chmod 600 .env
COMPOSE=(docker compose --project-directory "$ROOT" -f "$ROOT/compose.prod.yaml" --env-file "$ROOT/.env")
"${COMPOSE[@]}" config --quiet
"${COMPOSE[@]}" --profile migrate pull
"${COMPOSE[@]}" up -d --wait --wait-timeout 120 postgres
"${COMPOSE[@]}" --profile migrate run --rm migrate
"${COMPOSE[@]}" up -d --wait --wait-timeout 300 api caddy
"${COMPOSE[@]}" ps
printf '%s\n' 'Backend started. Verify HTTPS health and the Vercel sign-in before considering the deployment complete.'
