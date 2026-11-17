# Mediane: Vercel frontend + VPS backend

Repository: `https://github.com/mehdi-lakhzouri/mediane`.
VPS: `197.5.133.38`. The old deployment configuration is preserved on
`backup/azure-vunlera-2026-11-17`; the new production branch is `main` in this repository.
The archive contains tracked files only, not server secrets, databases or uploads.

## Addresses

- `https://YOUR-PROJECT.vercel.app`: the stable production URL assigned by Vercel.
- `https://api.197-5-133-38.sslip.io`: the API on the VPS. sslip.io resolves this name
  to `197.5.133.38` without any DNS setup; Caddy obtains its certificate. To move to
  an owned domain later, point an A record at the VPS and change `API_DOMAIN`,
  `API_PUBLIC_URL`, Vercel's `API_PROXY_TARGET` and the mobile/gateway API URLs.
  The template values `api.example.com` stand for this hostname.

```text
Browser -> https://YOUR-PROJECT.vercel.app
           /api/v1/* -> Vercel rewrite -> https://api.197-5-133-38.sslip.io/api/v1/*
                                            Caddy -> NestJS -> PostgreSQL
Mobile / cabin gateway -------------------------^
```

The browser API base is `/api/v1`, so HttpOnly session cookies stay on the Vercel
origin. Do not configure the browser to call the unrelated VPS origin directly:
the current authentication intentionally uses SameSite=Strict cookies, including
the refresh cookie. Changing only CORS does not solve that browser restriction.

## 1. Preserve the existing data before retiring the old host

If keeping existing accounts/devices, securely export PostgreSQL with `pg_dump -Fc`,
back up uploaded files, and save the actual runtime secrets. Do not copy a running
PostgreSQL data directory. Restore into the new PostgreSQL service before starting
the API. Use a final maintenance window to stop writes and the former safety worker,
take a final export and synchronize uploads. A test export is not continuous replication.

Preserve `JWT_ACCESS_SECRET`, `TOKEN_HASH_SECRET`, `MFA_ENCRYPTION_KEY` and the existing
device-encryption configuration. If `DEVICE_ENCRYPTION_KEY` was absent, leave it absent:
the application derives it from the MFA key. Adding a new key would make existing
device credentials unreadable. Preserve serials, device secrets and driver associations.
An empty database requires creating the administrator, drivers and devices again.

Keep `SAFETY_WORKER_ENABLED=false` on a test copy and avoid real SMS recipients.
Do not run two independent production workers against copies of the same pending incidents.

## 2. Prepare the VPS (Ubuntu assumption)

Install Docker Engine and the Compose plugin using the official Ubuntu instructions.
Allow inbound TCP 80 and 443 and limit SSH to administrators. Do not publish 5432,
3000 or 4000. Check that no existing service occupies ports 80/443 before starting Caddy.
Create a DNS A record for the new API hostname pointing to `197.5.133.38`; remove or
correct a conflicting AAAA record if the VPS does not serve that IPv6 address.
Caddy obtains/renews the HTTPS certificate once DNS and network access are ready.

From an SSH session on the VPS:

```bash
sudo mkdir -p /opt/mediane
sudo chown "$USER":"$(id -gn)" /opt/mediane
git clone https://github.com/mehdi-lakhzouri/mediane.git /opt/mediane
cd /opt/mediane
cp deploy/production.env.example deploy/.env
chmod 600 deploy/.env
```

Use a read-only deploy key or suitable repository authentication if the repository
is private. Run Docker commands with a user authorized to use Docker.

## 3. Configure the backend

Edit `deploy/.env` on the VPS. Example values to replace:

```dotenv
API_DOMAIN=api.197-5-133-38.sslip.io
API_PUBLIC_URL=https://api.197-5-133-38.sslip.io
FRONTEND_URL=https://YOUR-PROJECT.vercel.app
MOBILE_LINK_URL=https://YOUR-PROJECT.vercel.app/mobile
CORS_ORIGINS=https://YOUR-PROJECT.vercel.app
COOKIE_SECURE=true
COOKIE_SAME_SITE=strict
TRUST_PROXY=1
```

Set the PostgreSQL password and matching `DATABASE_URL`, application encryption
secrets and SMTP credentials. Generate fresh secrets only for a fresh installation.
Configure SMS only when needed. Keep all these secrets on the VPS, never in Git or
`NEXT_PUBLIC_*` variables. Uploads use a persistent local volume and need backups.

The immediate trusted proxy is Caddy. Browser traffic also crosses Vercel, so the
current one-hop setting groups browser rate limits by the proxy address; review
trusted proxy ranges before trying to recover the original browser IP. Do not
blindly trust every forwarded address or increase the hop count for direct device traffic.

## 4. Publish and start the backend

In GitHub Actions, let the **Containers** workflow finish on `main`. It publishes
`ghcr.io/mehdi-lakhzouri/cabinguard-backend` and `cabinguard-migrate` (the optional
web image remains available for the existing container security checks).
The new repository needs Actions enabled and package write permission; old
organization package permissions are not inherited.

For private images, sign into GHCR on the VPS using a read-only package token:

```bash
docker login ghcr.io -u mehdi-lakhzouri
```

Enter the token at the password prompt. Set `BACKEND_IMAGE` and `MIGRATE_IMAGE` in
`deploy/.env` to the same build's immutable `sha-xxxxxxx` tags or verified digests.
The template's `:main` tags are convenient for the first start but are mutable.

For a new installation:

```bash
cd /opt/mediane
bash deploy/deploy.sh
curl -fsS https://api.197-5-133-38.sslip.io/api/v1/health
```

The script pulls images, starts PostgreSQL, applies migrations and starts API/Caddy.
It does not deploy the frontend or provide automatic database rollback.

For a migration, first start PostgreSQL only, restore the final dump into its empty
database, and restore uploads with ownership writable by container uid/gid 65532:

```bash
cd /opt/mediane/deploy
docker compose --env-file .env -f compose.prod.yaml up -d --wait postgres
docker compose --env-file .env -f compose.prod.yaml exec -T postgres \
  pg_restore -U cabinguard -d cabinguard --no-owner --no-privileges < /secure/path/cabinguard.dump
cd ..
bash deploy/deploy.sh
```

If starting fresh, create the initial administrator interactively:

```bash
cd /opt/mediane/deploy
docker compose --env-file .env -f compose.prod.yaml run --rm api dist/cli.js admin:create
```

## 5. Configure Vercel

Import `mehdi-lakhzouri/mediane` into Vercel and select:

| Setting | Value |
| --- | --- |
| Framework | Next.js |
| Production branch | `main` |
| Root Directory | `frontend/apps/web` |
| Include source files outside the Root Directory | Enabled (shared workspace packages) |
| Node.js | 24.x |
| Install Command | `cd ../.. && pnpm install --frozen-lockfile` |
| Build Command | `cd ../.. && pnpm exec turbo run build --filter=web` |
| Output Directory | Next.js default |

Production environment variables:

```dotenv
NEXT_PUBLIC_API_BASE_URL=/api/v1
API_PROXY_TARGET=https://api.197-5-133-38.sslip.io
```

`API_PROXY_TARGET` is the HTTPS origin, WITHOUT `/api/v1`, a trailing path or credentials.
Both values affect the build; redeploy after changing them. The backend hostname
must be different from the Vercel frontend hostname to avoid a rewrite loop.
Once Vercel assigns the production URL, update backend `FRONTEND_URL`,
`MOBILE_LINK_URL` and `CORS_ORIGINS`, then recreate the API:

```bash
cd /opt/mediane/deploy
docker compose --env-file .env -f compose.prod.yaml up -d api
```

Use the stable production URL, not a per-commit preview URL. Previews should use a
separate test backend/database with their exact origin allowed there; do not
allow every `*.vercel.app` origin against the production API.

## 6. Point Hajer's gateway and the mobile app at the new API

For the Python gateway, from `AI module/dashboard_ai_models` on Hajer's machine:

```powershell
.\.venv\Scripts\python.exe -m gateway.configure `
  --api https://api.197-5-133-38.sslip.io/api/v1 `
  --serial THE_EXISTING_DEVICE_SERIAL
.\.venv\Scripts\python.exe run.py
```

Enter the existing device signing secret at the hidden prompt. The configuration
checks the device/driver association and saves the new destination locally in
ignored `.gateway/dashboard.json`. Check any `CABINGUARD_API_URL` environment
override as well. Existing queued messages belong to their original API/device;
do not edit the SQLite queue to move them between deployments.

The browser dashboard sends replay data; it does not turn playback into live alerts.
Physical hardware needs its own API URL changed in its firmware/configuration if
it does not use this Python gateway. It must preserve signed paths, request bytes,
serial/secret, valid TLS verification and an accurate clock. The server accepts
clock skew of 300 seconds by default. No MQTT service is required by this integration.

For Flutter, copy `driver_health_app/env/production.example.json` to
`driver_health_app/env/production.json` and replace its API URL. For Android App
Links, the build uses the Vercel host set in `android/app/build.gradle.kts`
(override with `-P appLinkHost=...`):

```powershell
flutter build apk --release --dart-define-from-file=env/production.json
```

Run the build from `driver_health_app`. Publish the actual APK signing fingerprint
in `frontend/apps/web/public/.well-known/assetlinks.json` on Vercel. Rebuild/reinstall
the app after changing the host or its API. The fallback `cabinguard://` handoff
remains available from the mobile landing pages.

## 7. Validate, activate and operate

Before retiring the previous deployment, verify:

1. Direct API HTTPS health: database is up and certificate is valid.
2. Vercel `/api/v1/health`: reaches the same backend without a redirect.
3. Browser sign-in, authenticated reads, a state-changing request, refresh and logout.
   Verify access/refresh/CSRF cookies use the Vercel host and Secure attributes.
4. Invitation/reset links use the new frontend, uploads load, and mobile authentication works.
5. Hajer's signed heartbeat and replay arrive under the intended driver;
   timestamps, serial, association and secret match.
6. Backups of PostgreSQL, uploads and secrets are recoverable.

Enable `SAFETY_WORKER_ENABLED=true` only on the final active backend, then recreate
the API. Stop the former worker before enabling this one. Retire the old host only
after final data transfer and these checks. An application-image rollback does not
undo migrations or merge data written after cutover.

Future frontend changes deploy through Vercel's Git integration. For the backend,
wait for the scanned images, select their matching image references in `deploy/.env`,
take a backup, and run `bash deploy/deploy.sh` over SSH. Check logs with:

```bash
cd /opt/mediane/deploy
docker compose --env-file .env -f compose.prod.yaml ps
docker compose --env-file .env -f compose.prod.yaml logs --tail 100 api caddy
```

## References

- [Vercel monorepos](https://vercel.com/docs/monorepos)
- [Vercel rewrites](https://vercel.com/docs/routing/rewrites)
- [Next.js external rewrites](https://nextjs.org/docs/app/api-reference/config/next-config-js/rewrites)
- [Docker Engine on Ubuntu](https://docs.docker.com/engine/install/ubuntu/)
- [Caddy automatic HTTPS](https://caddyserver.com/docs/automatic-https)
- [PostgreSQL pg_dump](https://www.postgresql.org/docs/current/app-pgdump.html)
