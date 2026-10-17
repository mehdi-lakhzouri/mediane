# syntax=docker/dockerfile:1
# CabinGuard web (Next.js standalone). Build context: frontend/
#
#   docker build -f frontend/apps/web/Dockerfile \
#     --build-arg NEXT_PUBLIC_API_BASE_URL=https://api.example.com/api/v1 \
#     -t cabinguard-web frontend
#
# NEXT_PUBLIC_* values are inlined into the browser bundle at build time:
# one image per API origin.

ARG NODE_IMAGE=node:24-trixie-slim@sha256:7f486cabe892bff8fef04c0f7da8dba84a560be3e4e2740b7a86afc57ebec315
ARG RUNTIME_IMAGE=gcr.io/distroless/nodejs24-debian13:nonroot@sha256:59c479c9b8c123e66047315c968aa2d35e31ae5149c856e4110a79c8b3563f0b

# --- dependencies: manifests only, so this layer is cached until they change --
FROM ${NODE_IMAGE} AS deps
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json
COPY packages/typescript-config/package.json packages/typescript-config/package.json
RUN pnpm install --frozen-lockfile --filter web...

# --- build -----------------------------------------------------------------
FROM deps AS build
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api/v1
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL} \
    NEXT_TELEMETRY_DISABLED=1
COPY . .
RUN pnpm --filter web build

# --- runtime: distroless, no shell, uid 65532 --------------------------------
FROM ${RUNTIME_IMAGE} AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /repo/apps/web/public ./apps/web/public
# Only the Next.js cache directory is writable by the process.
COPY --from=build --chown=65532:65532 /repo/apps/web/.next/cache ./apps/web/.next/cache
USER 65532:65532
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD ["/nodejs/bin/node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/sign-in').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
CMD ["apps/web/server.js"]
