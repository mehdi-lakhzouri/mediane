# CabinGuard

CabinGuard is a driver-safety platform developed for the IEEE EMBS/VTS TSYP14 challenge. It combines a secure administration console, a mobile API for drivers, family safety features, and the foundations for multimodal in-cabin medical-event detection.

> The administration console and the authentication, profile, MFA, invitation, and family APIs are implemented. The Flutter application has its production foundation and implementation roadmap; product screens are being built from the specifications in [`design/mobile-app`](design/mobile-app/README.md). Medical-event detection and vehicle-response services are outside the current implementation.

## System architecture

```mermaid
flowchart LR
    A[Admin browser] -->|HttpOnly cookies + CSRF| W[Next.js admin console]
    W -->|REST /api/v1| B[NestJS API]
    M[Flutter driver app] -->|Bearer access token| B
    B --> P[(PostgreSQL)]
    B --> O[Local or S3-compatible object storage]
    B --> S[SMTP provider]
    B -. future distributed throttling .-> R[(Redis)]
```

The backend is a modular NestJS application. Controllers expose transport-specific contracts, application services coordinate use cases, domain objects enforce business rules, and Prisma repositories handle persistence. The web application uses the Next.js App Router and a shared UI package inside a pnpm/Turborepo workspace. Mobile sessions reuse the same authentication domain while returning tokens in the response body instead of cookies.

## Repository layout

```text
.
├── backend/                 NestJS REST API, Prisma schema, CLI, and tests
├── frontend/
│   ├── apps/web/            Next.js administration console
│   └── packages/            Shared UI, ESLint, and TypeScript packages
├── driver_health_app/       Flutter mobile application and delivery plan
├── docker/                  Local PostgreSQL and Redis services
└── design/mobile-app/       Mobile UX specifications and generated mockups
```

## Technology stack

| Area | Technology |
|---|---|
| API | NestJS 11, TypeScript, Prisma 7, PostgreSQL |
| Authentication | JWT access tokens, rotating refresh sessions, Argon2id, TOTP MFA |
| Web | Next.js 16, React 19, Tailwind CSS 4, shared shadcn-style UI components |
| Mobile | Flutter and Dart |
| Storage | Local signed files in development; private S3-compatible storage in production |
| Email | Nodemailer through SMTP |
| Tooling | pnpm workspaces, Turborepo, Jest, Playwright, ESLint, Docker Compose |

## Implemented capabilities

- Administrator sign-in, mandatory password change, TOTP enrollment, recovery codes, password recovery, and session revocation.
- User invitation, resend/revoke flows, lifecycle management, suspension, restoration, MFA reset, and controlled permanent deletion.
- Driver mobile authentication with bearer access tokens and rotating refresh tokens.
- Driver profile onboarding with phone number, date of birth, gender, ordered emergency contacts, and sanitized profile photos.
- Family creation, invite-code rotation, join requests, owner approval, membership management, ownership transfer, and leave/dissolve flows.
- Explicit per-member sharing consent for phone number, incident notifications, and recent health status.
- Audit logging, request correlation IDs, rate limiting, validation, standardized errors, and health checks.

## Prerequisites

- Node.js 24 or later
- npm for the backend
- pnpm 12.4.2 for the frontend (`corepack` is recommended)
- Docker Desktop or Docker Engine with Compose
- Flutter with a Dart SDK compatible with `^3.13.4` for mobile development

## Local setup

### 1. Configure the environment

From the repository root, copy the provided templates:

```bash
cp docker/.env.example docker/.env
cp backend/.env.example backend/.env
cp frontend/apps/web/.env.example frontend/apps/web/.env.local
```

PowerShell equivalent:

```powershell
Copy-Item docker/.env.example docker/.env
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/apps/web/.env.example frontend/apps/web/.env.local
```

Replace every placeholder secret. The PostgreSQL credentials in `docker/.env` must match `DATABASE_URL` in `backend/.env`. Generate application secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Use separate values for `JWT_ACCESS_SECRET`, `TOKEN_HASH_SECRET`, and `MFA_ENCRYPTION_KEY`. Keep `MFA_ENCRYPTION_KEY` stable because changing it invalidates enrolled authenticators.

### 2. Start infrastructure

```bash
docker compose --env-file docker/.env -f docker/compose.yaml up -d
docker compose --env-file docker/.env -f docker/compose.yaml ps
```

PostgreSQL listens on `127.0.0.1:5432` by default. Redis listens on `127.0.0.1:6379`; it is provisioned for future shared rate-limit/session infrastructure, while the current API rate limiter uses in-process storage.

### 3. Install and migrate the backend

```bash
cd backend
npm ci
npm run prisma:migrate:deploy
npm run start:dev
```

The API starts on `http://localhost:4000` by default. Environment variables are validated at startup and invalid production combinations are rejected.

Create the first administrator in a second terminal:

```bash
cd backend
npm run cli -- admin:create
```

The interactive command asks for the email, name, and a password of at least 12 characters. Passwords are deliberately not accepted as command-line arguments. For automation, pass identity fields as flags and pipe the password through standard input with `--password-stdin`.

### 4. Start the web console

```bash
cd frontend
corepack enable
corepack prepare pnpm@12.4.2 --activate
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://localhost:3000` for the marketing site and `http://localhost:3000/sign-in` for the console. The browser client calls `http://localhost:4000/api/v1` unless `NEXT_PUBLIC_API_BASE_URL` overrides it.

### 5. Run the Flutter application

```bash
cd driver_health_app
flutter pub get
flutter run
```

The current Flutter target contains the production architecture and platform foundation. Follow the [mobile implementation plan](driver_health_app/docs/IMPLEMENTATION_PLAN.md) and [mobile screen pack](design/mobile-app/README.md) for feature delivery.

## Local URLs

| Service | URL |
|---|---|
| Marketing site | `http://localhost:3000` |
| Web console sign-in | `http://localhost:3000/sign-in` |
| API base | `http://localhost:4000/api/v1` |
| API health | `http://localhost:4000/api/v1/health` |
| Swagger UI | `http://localhost:4000/api/docs` |

Swagger is available only when `SWAGGER_ENABLED=true` outside production.

## API conventions

Every response uses the same envelope:

```json
{
  "data": {},
  "meta": {
    "requestId": "request-correlation-id",
    "timestamp": "2026-10-02T09:41:00.000Z"
  },
  "error": null
}
```

Failures set `data` to `null` and return a structured `error` containing a stable code, a message, and optional field details. Paginated endpoints add `page`, `pageSize`, `totalItems`, and `totalPages` under `meta.pagination`.

### Authentication channels

| Client | Session transport | Mutation protection |
|---|---|---|
| Web console | Access and refresh tokens in HttpOnly cookies | `X-CSRF-Token` from `GET /auth/csrf` |
| Mobile app | Access token in `Authorization: Bearer`; refresh token in request body | Native clients do not use browser CSRF cookies |

Access tokens are short-lived. Refresh tokens rotate on use, and replaying an old token revokes the affected session. Password changes and sensitive administrator actions can revoke every active device session.

### Endpoint summary

All paths below are relative to `/api/v1`.

| Area | Methods and paths | Purpose |
|---|---|---|
| Health | `GET /health` | API and database readiness |
| Web auth | `GET /auth/csrf`, `POST /auth/login`, `POST /auth/mfa/challenge`, `POST /auth/refresh`, `POST /auth/logout` | Browser session lifecycle |
| Account | `GET /auth/me`, `POST /auth/logout-all`, `POST /auth/password/change`, `POST /auth/password/forgot`, `POST /auth/password/reset` | Identity and password management |
| Mobile auth | `POST /auth/mobile/login`, `POST /auth/mobile/mfa/challenge`, `POST /auth/mobile/refresh`, `POST /auth/mobile/logout`, `POST /auth/mobile/password/change` | Driver app session lifecycle |
| MFA | `GET /auth/mfa`, `POST /auth/mfa/totp/setup`, `POST /auth/mfa/totp/confirm`, `POST /auth/mfa/recovery-codes`, `POST /auth/mfa/totp/disable` | Authenticator and recovery-code management |
| Invitations | `POST /invitations/accept` | Accept an administrator-issued account invitation |
| Driver profile | `GET /profile`, `PUT /profile`, `PUT /profile/avatar`, `DELETE /profile/avatar` | Profile, emergency contacts, and photo |
| Admin users | `POST /admin/users`, `GET /admin/users`, `GET/PATCH /admin/users/:userId` | Create, list, inspect, and edit users |
| User lifecycle | `POST .../suspend`, `POST .../reactivate`, `DELETE /admin/users/:userId`, `POST .../restore`, `POST .../mfa/reset`, `POST .../hard-delete` | Administrative account lifecycle |
| Admin invitations | `GET /admin/users/:userId/invitation`, `POST .../resend`, `POST .../revoke` | Invitation lifecycle |
| Driver families | `GET /families/mine`, `POST /families`, `PATCH/DELETE /families/mine` | Create, inspect, rename, or dissolve a family |
| Family invites | `GET /families/mine/invite`, `POST /families/mine/invite/rotate`, `GET /families/invites/:code`, `POST /families/join`, `DELETE /families/join-request` | Invite-code and join-request lifecycle |
| Family approvals | `GET /families/mine/join-requests`, `POST .../:requestId/approve`, `POST .../:requestId/reject` | Owner moderation |
| Family membership | `DELETE /families/mine/members/:userId`, `POST /families/mine/owner`, `POST /families/mine/leave`, `PUT /families/mine/sharing` | Members, ownership, departure, and consent |
| Admin families | `GET /admin/families`, `GET /admin/families/:familyId`, member/owner mutations, `DELETE /admin/families/:familyId` | Administrative family management |

Use Swagger for DTO schemas, response types, required roles, and the complete error catalogue.

## Account onboarding

Account state is derived from persisted facts instead of being stored as a mutable workflow enum:

```text
INVITED
  → PASSWORD_CHANGE_REQUIRED
  → MFA_SETUP_REQUIRED       (required for administrators)
  → PROFILE_SETUP_REQUIRED   (required for drivers)
  → ACTIVE
```

`SUSPENDED` and `DELETED` take precedence over onboarding progress. Restoring or reactivating an account returns it to the correct incomplete step.

## Security model

- Passwords are hashed with Argon2id and validated against a centralized policy.
- Refresh, invitation, password-reset, and recovery tokens are stored as hashes.
- TOTP secrets are encrypted at rest with AES-256-GCM.
- Web access and refresh tokens never enter browser JavaScript.
- CSRF protection is required for cookie-authenticated mutations.
- Role and account-state guards run globally after throttling, CSRF, and authentication checks.
- Profile photos are decoded, resized to 512 × 512 WebP, and stripped of metadata before storage.
- S3 buckets must remain private; clients receive short-lived signed download URLs.
- Audit records are append-only and sanitize secret or personal payload data.
- CORS uses an explicit origin allow-list and Swagger is forcibly disabled in production.

## Validation and tests

Backend:

```bash
cd backend
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run build
```

Frontend:

```bash
cd frontend
pnpm lint
pnpm typecheck
pnpm build
```

Flutter:

```bash
cd driver_health_app
flutter analyze
flutter test
```

Web E2E (Playwright), against a running API and web app. The admin must exist without an authenticator; the suite enrolls one:

```bash
cd backend && printf '%s' "$ADMIN_PASSWORD" | npm run cli -- admin:create --email "$ADMIN_EMAIL" --first-name E2E --last-name Admin --password-stdin
cd frontend/apps/web
pnpm exec playwright install chromium
ADMIN_EMAIL=... ADMIN_PASSWORD=... WEB_URL=http://localhost:3000 API_URL=http://localhost:4000/api/v1 pnpm test:e2e
```

## CI/CD and security pipeline

Every change goes through the same DevSecOps pipeline, from the developer's machine to the published container images, and the running application is attacked every night. The workflows live in `.github/workflows/`.

```mermaid
flowchart TB
    dev([Developer]) --> hooks["<b>pre-commit hooks</b><br/>Gitleaks · private keys · actionlint · hadolint<br/>ESLint · Prettier · dart format · Conventional Commits"]
    hooks --> pr["Pull request"]

    subgraph PRC["On every pull request"]
        direction LR
        ci["<b>ci.yml</b><br/>backend: lint · types · 130 unit · 110 e2e on PostgreSQL<br/>frontend: lint · types · build<br/>mobile: format · analyze · 142 tests<br/>Playwright: 14 browser tests"]
        sec["<b>security.yml</b><br/>Gitleaks (full history) · Semgrep<br/>Trivy (lockfiles + IaC) · pre-commit<br/>CodeQL · dependency review ¹"]
        img["<b>containers.yml</b><br/>build backend · migrate · web<br/>Trivy image scan"]
    end
    pr --> ci & sec & img
    ci --> gate{{"CI success"}}
    gate -->|review + merge| main[("main")]

    subgraph PUB["On push to main or a v* tag"]
        push["Trivy scan, then push to GHCR<br/>SBOM + SLSA provenance<br/>Cosign signature + attestations ¹, verified"]
    end
    main --> push --> ghcr[("ghcr.io/hajer-s-org/cabinguard-*")]

    subgraph CRON["Scheduled (UTC)"]
        dast["<b>02:00 daily</b> · dast.yml<br/>OWASP ZAP daemon vs the production images"]
        weekly["<b>Mon 03:17</b> · security.yml<br/>full static scan, fresh advisories"]
        rescan["<b>04:41 daily</b> · containers.yml<br/>Trivy re-scan of the published images"]
    end
    main -.-> dast & weekly
    ghcr -.-> rescan

    sec & img & push & dast & weekly & rescan --> findings[["Findings: Security › Code scanning ¹<br/>or SARIF artifacts + job summaries"]]
```

¹ Public repository, or `GHAS_ENABLED=true` with GitHub Advanced Security. On a private repository these steps are skipped automatically and every report is kept as a `sarif-*` workflow artifact with a findings table on the job page; nothing in the workflows has to change when the visibility does. Dependency review also needs the **Dependency graph** repository setting; without it the job is skipped and Trivy still checks every lockfile.

### Workflows

| Workflow | Runs on | What it does |
| --- | --- | --- |
| `ci.yml` | PR, push to `main`, manual | Backend lint, Prettier, types, unit tests with coverage, build, migrations and e2e tests on PostgreSQL 18. Frontend lint, types, build. Flutter format, analyze, tests. Playwright E2E against the real API, PostgreSQL and `next start`, with every secret generated per run. On PRs, untouched projects are skipped. **`CI success`** aggregates every job and is the one check to require. |
| `security.yml` | PR, push to `main`, Mondays 03:17 UTC, manual | Gitleaks over the whole git history, Semgrep (OWASP Top 10, Node.js, TypeScript, React), Trivy on every lockfile and on the Dockerfiles/compose files, the pre-commit hooks. CodeQL when Code scanning is available; dependency review when the **Dependency graph** setting is on too (Settings › Code security). |
| `containers.yml` | PR (backend/frontend changes), push to `main`, `v*` tags, daily 04:41 UTC, manual | Builds the `backend`, `migrate` and `web` images (distroless, uid 65532, base images pinned by digest) and scans them with Trivy **before** any push. On `main` and tags: pushes to GHCR with a BuildKit SBOM and SLSA provenance, an SPDX SBOM artifact, and on a public repository a Cosign keyless signature and GitHub attestations, both verified in the same job. Every day, re-scans the published `:main` images for CVEs disclosed after the build. |
| `dast.yml` | daily 02:00 UTC, manual | Runs the production images in production mode (read-only filesystem, no capabilities) on an isolated network with PostgreSQL and Mailpit. OWASP ZAP runs as a daemon with an API key generated per run; `zap_scan.py` imports the 90 API routes from the OpenAPI document, crawls the web app, runs the passive and a time-boxed active scan (20 min), and writes HTML, JSON and SARIF reports. |

All scheduled workflows run from `main` and can be started by hand:

```bash
gh workflow run dast.yml -f ascan_minutes=30
gh workflow run security.yml
gh workflow run containers.yml
```

### Security gate

The repository variable `SECURITY_GATE_MODE` decides whether security findings block:

| Finding | `audit` (default) | `enforce` |
| --- | --- | --- |
| Secret in the git history (Gitleaks) | reported | fails |
| Fixable HIGH/CRITICAL vulnerability (Trivy: lockfiles, images, published images) | reported | fails |
| Semgrep ERROR | reported | fails |
| New vulnerable dependency in a PR (dependency review) | warning | fails |
| ZAP alert of risk High | reported | fails |

Tests, lint and type checks always block. Accepted exceptions are never silent: they go in `.trivyignore`, `.gitleaks.toml` or `.github/dast/zap-alert-filters.json`, each with a justification, an owner and a review date.

### Pipeline hardening

- Actions are pinned by commit SHA and container images by digest.
- Tokens are least-privilege (`contents: read` by default, write scopes per job) and checkout never persists credentials.
- No secret is stored for testing: JWT, HMAC and MFA keys, the E2E admin password and the ZAP API key are generated per run and masked.
- Gitleaks is installed from a checksum-verified release.

### Keeping dependencies current

Updates are made deliberately (there is no automated update bot). Trivy reports known vulnerabilities on every PR, every Monday on `main`, and every day on the published images; the report names the fixed version to move to. Pinned versions to bump by hand:

```bash
gh api repos/<owner>/<action>/releases/latest --jq .tag_name                   # GitHub Action, then pin its commit SHA
docker buildx imagetools inspect node:24-trixie-slim --format '{{json .Manifest.Digest}}'   # base image digest
```

### Verifying a published image

```bash
cosign verify ghcr.io/hajer-s-org/cabinguard-backend@sha256:<digest> \
  --certificate-identity-regexp '^https://github.com/hajer-s-org/EMBs-x-VTS-CabinGuard-ADI/' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com
gh attestation verify oci://ghcr.io/hajer-s-org/cabinguard-backend@sha256:<digest> \
  -R hajer-s-org/EMBs-x-VTS-CabinGuard-ADI
```

### Running it locally

Container images run as a non-root user on distroless bases (no shell, no package manager):

```bash
docker build -t cabinguard-backend backend
docker build -t cabinguard-migrate --target migrate backend
docker build -f frontend/apps/web/Dockerfile --build-arg NEXT_PUBLIC_API_BASE_URL=https://api.example.com/api/v1 -t cabinguard-web frontend
```

The DAST stack (all ports bound to 127.0.0.1):

```bash
export ZAP_API_KEY=$(openssl rand -hex 32) JWT_ACCESS_SECRET=$(openssl rand -hex 32) \
  TOKEN_HASH_SECRET=$(openssl rand -hex 32) MFA_ENCRYPTION_KEY=$(openssl rand -base64 32)
mkdir -p zap-reports && docker compose -f .github/dast/compose.dast.yaml up -d --wait
DATABASE_URL=postgresql://dast:dast@127.0.0.1:55432/cabinguard bash .github/dast/export-openapi.sh zap-reports/openapi.json
python3 .github/dast/zap_scan.py   # reports in zap-reports/
docker compose -f .github/dast/compose.dast.yaml down -v
```

### Contributing: local hooks

Commits run the same checks as CI (secrets, YAML, workflows, Dockerfiles, ESLint, Prettier, `dart format`) and require [Conventional Commits](https://www.conventionalcommits.org/) messages:

```bash
pipx install pre-commit   # or: pip install pre-commit
pre-commit install --install-hooks
```

## Environments

| | Local (your PC) | Production (the Azure VM) |
| --- | --- | --- |
| Purpose | develop and test | the demo at `https://app.vunlera.tn` |
| Configuration templates | `backend/.env.example` → `backend/.env`<br>`docker/.env.example` → `docker/.env`<br>`frontend/apps/web/.env.example` → `.env.local`<br>`driver_health_app/env/dev-lan.example.json` | `deploy/production.env.example` (reference only)<br>`driver_health_app/env/production.example.json` |
| Who writes the real file | you, by copying the template | the deploy workflow, from the GitHub environment `production`, into `/opt/cabinguard/.env` (mode 600) |
| Where the secrets live | your `.env` files (gitignored) | GitHub environment secrets; never in the repository or on your PC |
| How it runs | `docker compose` for PostgreSQL and Redis, then `npm run start:dev` and `pnpm dev` | containers from GHCR, pinned by digest, behind Caddy (`deploy/compose.prod.yaml`) |
| URLs | `http://localhost:3000`, `http://localhost:4000/api/v1` | `https://app.vunlera.tn`, `https://api.vunlera.tn/api/v1` |
| `NODE_ENV` | `development` (Swagger on, plain HTTP allowed) | `production` (HTTPS only, Secure cookies, Swagger refused) |
| Photos | `backend/uploads` | Docker volume `uploads` on the VM |
| Mail | your SMTP settings, or a local catcher | Gmail SMTP with an app password |

Run the production stack itself on your PC before deploying: build the three images, then follow *Running it locally* in the pipeline section above.

## Production deployment

The demo runs on one Azure VM (Ubuntu 24.04, Standard B2ls_v2) behind `app.vunlera.tn` (console) and `api.vunlera.tn` (API). `.github/workflows/deploy.yml` delivers the images that `containers.yml` built, scanned and published, pinned by digest.

```mermaid
flowchart LR
    gh["deploy.yml<br/>(GitHub Actions)"] -->|"OIDC, no stored Azure secret"| az["Azure"]
    az -->|"Run Command, no SSH"| vm
    subgraph vm["VM: only ports 80 and 443 open"]
        caddy["Caddy<br/>Let's Encrypt TLS, HTTP to HTTPS"] --> web["web"]
        caddy --> api["api"]
        api --> pg[("PostgreSQL<br/>internal network")]
        api --> up[("uploads volume")]
    end
    users(["Browsers and the mobile app"]) -->|HTTPS| caddy
```

`deploy/deploy.sh` runs on the VM: it writes the configuration (mode 600), pulls the images by digest with the job's short-lived token, applies the database migrations, starts the release, checks `https://api…/api/v1/health` and `https://app…/sign-in` through Caddy, and **restarts the previous release automatically** if the new one is not healthy. The `verify` job then checks TLS, the HTTP redirect and the security headers from outside.

Migrations only move forward: a rollback restarts the previous images, not the previous schema, so keep migrations compatible with the version before them.

### Configuration

Environment `production` (Settings › Environments; deployments from `main` only):

| Kind | Name | Value |
| --- | --- | --- |
| Variable | `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` | the deployment identity: a user-assigned managed identity with the role *Virtual Machine Contributor* on the VM only, and a federated credential whose subject is the organisation's immutable form, `repo:hajer-s-org@344101369/EMBs-x-VTS-CabinGuard-ADI@1365926680:environment:production` (issuer `https://token.actions.githubusercontent.com`, audience `api://AzureADTokenExchange`) |
| Variable | `AZURE_RESOURCE_GROUP`, `AZURE_VM_NAME` | `rg-cabinguard-prod`, `vm-cabinguard-prod` |
| Variable | `APP_DOMAIN`, `API_DOMAIN` | `app.vunlera.tn`, `api.vunlera.tn` |
| Variable | `MAIL_FROM` | `CabinGuard <address@gmail.com>` |
| Secret | `POSTGRES_PASSWORD` | `openssl rand -hex 32` (alphanumeric: it goes into a URL) |
| Secret | `JWT_ACCESS_SECRET`, `TOKEN_HASH_SECRET` | `openssl rand -base64 48`, two different values |
| Secret | `MFA_ENCRYPTION_KEY`, `DEVICE_ENCRYPTION_KEY` | `openssl rand -base64 32`; **never change them**: enrolled authenticators and device secrets depend on them |
| Secret | `MAIL_USER`, `MAIL_PASSWORD` | the Gmail address and an app password |

Repository variable `NEXT_PUBLIC_API_BASE_URL=https://api.vunlera.tn/api/v1`: the web image is built with it, so set it before the build that you deploy.

For this single-server demo the photos are stored on the VM (`STORAGE_LOCAL_IN_PRODUCTION=true`, a Docker volume); there is no database backup. Moving to Cloudflare R2 or Amazon S3 later means setting `STORAGE_DRIVER=s3` and the `S3_*` variables, with no code change.

### Deploying

```bash
gh workflow run deploy.yml                       # the latest images built from main
gh workflow run deploy.yml -f version=sha-1a2b3c4  # a given build, e.g. to roll back by hand
```

Starting the workflow is the approval: required reviewers on an environment need a paid plan for a private organisation repository. With the repository variable `AUTO_DEPLOY=true`, `containers.yml` deploys every green build of `main`.

The first administrator, once (the password is read from stdin, never from the command line):

```bash
az vm run-command invoke -g rg-cabinguard-prod -n vm-cabinguard-prod --command-id RunShellScript --scripts \
  "cd /opt/cabinguard && printf '%s' 'CHANGE-ME-long-password' | docker compose --env-file release.env -f compose.prod.yaml run --rm -T api dist/cli.js admin:create --email admin@vunlera.tn --first-name Admin --last-name CabinGuard --password-stdin"
```

### Links that open the driver app

Administrators work in the web console, drivers only in the mobile app, so their emailed links differ:

| Link | Administrator | Driver |
| --- | --- | --- |
| Invitation | `https://app.vunlera.tn/accept-invitation#token=…` (web) | `https://app.vunlera.tn/mobile/accept-invitation#token=…` |
| Family invite | — | `https://app.vunlera.tn/mobile/join-family#CODE` |

On an Android phone with the app, `/mobile/...` links open the app directly (Android App Links, declared in `AndroidManifest.xml`). Android trusts them because the site publishes `/.well-known/assetlinks.json` with the app's package and the SHA-256 of the certificate that signs the APK. Anywhere else (no app, a computer), the same URL shows a page that hands the link over to the app (`cabinguard://app/...`) and never redeems the token itself.

**When the signing key changes** (another computer's debug key, or a real release key), add its fingerprint to `frontend/apps/web/public/.well-known/assetlinks.json`, otherwise Android shows the hand-over page instead of opening the app:

```bash
keytool -list -v -keystore <keystore> -alias <alias> | grep SHA256   # or: apksigner verify --print-certs app.apk
```

### Operating the VM

| Task | Command |
| --- | --- |
| Stop (compute billing stops, IP and data kept) | `az vm deallocate -g rg-cabinguard-prod -n vm-cabinguard-prod` |
| Start (the stack restarts by itself) | `az vm start -g rg-cabinguard-prod -n vm-cabinguard-prod` |
| Status of the containers | `az vm run-command invoke -g rg-cabinguard-prod -n vm-cabinguard-prod --command-id RunShellScript --scripts "cd /opt/cabinguard && docker compose --env-file release.env -f compose.prod.yaml ps"` |
| Recent API logs | same, with `logs --tail 100 api` |

## Storage and email

Development defaults to signed files under `backend/uploads`. Production requires `STORAGE_DRIVER=s3` and a private S3-compatible bucket. AWS IAM roles or another provider's short-lived credentials are preferred over static keys.

Invitation and password-reset messages are sent through the configured SMTP server. Gmail App Password and local SMTP-catcher examples are documented in [`backend/.env.example`](backend/.env.example).

## Stopping the local stack

```bash
docker compose --env-file docker/.env -f docker/compose.yaml down
```

To remove local PostgreSQL and Redis volumes as well, run `docker compose --env-file docker/.env -f docker/compose.yaml down --volumes`. This permanently deletes local development data.
