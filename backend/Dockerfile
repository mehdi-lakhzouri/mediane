# syntax=docker/dockerfile:1
# CabinGuard API. Build context: backend/
#
#   docker build -t cabinguard-backend backend                    # runtime (default)
#   docker build -t cabinguard-migrate --target migrate backend   # prisma migrate deploy
#
# Builder and runtime share the same Debian release (trixie), so the native
# modules compiled here (argon2, sharp) find the same glibc at runtime.
# Base images are pinned by digest: bump them deliberately (docker buildx
# imagetools inspect <image>:<tag>); the daily Trivy re-scan says when.

ARG NODE_IMAGE=node:24-trixie-slim@sha256:7f486cabe892bff8fef04c0f7da8dba84a560be3e4e2740b7a86afc57ebec315
ARG RUNTIME_IMAGE=gcr.io/distroless/nodejs24-debian13:nonroot@sha256:59c479c9b8c123e66047315c968aa2d35e31ae5149c856e4110a79c8b3563f0b

# --- dependencies (full, including the prisma CLI) ---------------------------
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
# postinstall runs `prisma generate` into src/generated (no database needed).
RUN npm ci --no-audit --no-fund

# --- build, then drop dev dependencies ---------------------------------------
FROM deps AS build
COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build \
 && npm prune --omit=dev --no-audit --no-fund

# --- migrations: one-shot job run before the API is (re)started --------------
# Distroless too: the Prisma CLI is called directly, so no npm/npx in the image.
FROM ${RUNTIME_IMAGE} AS migrate
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/package.json /app/prisma.config.ts ./
COPY --from=deps /app/prisma ./prisma
COPY --from=deps /app/node_modules ./node_modules
USER 65532:65532
CMD ["node_modules/prisma/build/index.js", "migrate", "deploy"]

# --- runtime: distroless, no shell, no package manager, uid 65532 -------------
FROM ${RUNTIME_IMAGE} AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=4000
# Files stay owned by root: the nonroot process can read them, never rewrite them.
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
USER 65532:65532
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD ["/nodejs/bin/node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/v1/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
CMD ["dist/main.js"]
