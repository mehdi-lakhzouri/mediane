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

GitHub Actions workflows live in `.github/workflows/`:

| Workflow | Trigger | What it does |
| --- | --- | --- |
| `ci.yml` | PR, push to `main` | Backend lint, format, types, unit tests with coverage, build, e2e on PostgreSQL. Frontend lint, types, build. Flutter format, analyze, tests. Playwright E2E on the full stack. `CI success` is the single check to require. |
| `security.yml` | PR, push to `main`, weekly | Gitleaks (whole history), CodeQL, Semgrep, Trivy (dependencies and IaC), dependency review on PRs, pre-commit hygiene. |
| `containers.yml` | PR, push to `main`, `v*` tags, daily | Builds the `backend`, `migrate` and `web` images, scans them with Trivy. On `main` and tags: pushes to GHCR with an SBOM and build provenance; on a public repository also a Cosign keyless signature and GitHub attestations. Re-scans the published images daily. |
| `dast.yml` | nightly, manual | Runs the production images on an isolated network and scans the API (from its OpenAPI document) and the web app with OWASP ZAP in daemon mode. |

Findings appear under **Security > Code scanning** when the repository has it (public, or `GHAS_ENABLED=true` with GitHub Advanced Security); on a private repository each report is kept as a `sarif-*` workflow artifact and summarized on the job page. CodeQL, dependency review, Cosign and attestations switch on by themselves once the repository is public. The repository variable `SECURITY_GATE_MODE` decides whether they block: `audit` (default) reports only, `enforce` fails the run on secrets, fixable HIGH/CRITICAL vulnerabilities, SAST errors and high-risk DAST alerts. Accepted exceptions go in `.trivyignore`, `.gitleaks.toml` and `.github/dast/zap-alert-filters.json`, each with a justification.

Container images run as a non-root user on distroless bases (no shell, no package manager):

```bash
docker build -t cabinguard-backend backend
docker build -t cabinguard-migrate --target migrate backend
docker build -f frontend/apps/web/Dockerfile --build-arg NEXT_PUBLIC_API_BASE_URL=https://api.example.com/api/v1 -t cabinguard-web frontend
```

Run the DAST stack locally (all ports bound to 127.0.0.1):

```bash
export ZAP_API_KEY=$(openssl rand -hex 32) JWT_ACCESS_SECRET=$(openssl rand -hex 32) \
  TOKEN_HASH_SECRET=$(openssl rand -hex 32) MFA_ENCRYPTION_KEY=$(openssl rand -base64 32)
mkdir -p zap-reports && docker compose -f .github/dast/compose.dast.yaml up -d --wait
DATABASE_URL=postgresql://dast:dast@127.0.0.1:55432/cabinguard bash .github/dast/export-openapi.sh zap-reports/openapi.json
python3 .github/dast/zap_scan.py   # reports in zap-reports/
docker compose -f .github/dast/compose.dast.yaml down -v
```

### Contributing: local hooks

Commits run the same hygiene checks as CI (secrets, YAML, workflows, Dockerfiles, ESLint, Prettier, `dart format`) and require [Conventional Commits](https://www.conventionalcommits.org/) messages:

```bash
pipx install pre-commit   # or: pip install pre-commit
pre-commit install --install-hooks
```

## Storage and email

Development defaults to signed files under `backend/uploads`. Production requires `STORAGE_DRIVER=s3` and a private S3-compatible bucket. AWS IAM roles or another provider's short-lived credentials are preferred over static keys.

Invitation and password-reset messages are sent through the configured SMTP server. Gmail App Password and local SMTP-catcher examples are documented in [`backend/.env.example`](backend/.env.example).

## Stopping the local stack

```bash
docker compose --env-file docker/.env -f docker/compose.yaml down
```

To remove local PostgreSQL and Redis volumes as well, run `docker compose --env-file docker/.env -f docker/compose.yaml down --volumes`. This permanently deletes local development data.
