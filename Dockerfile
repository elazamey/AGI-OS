# ============================================================================
# AGI OS — Multi-Stage Dockerfile
# Stages: base → builder → runtime → dashboard
# ----------------------------------------------------------------------------
# Two defects here made `docker build` fail in CI, both now fixed:
#
#   1. `corepack prepare pnpm@latest --activate` installed pnpm 10 against a
#      lockfileVersion 6.0 file, so `pnpm install --frozen-lockfile` could not
#      reconcile them. The version is now pinned to the `packageManager` field
#      in package.json — the single source of truth shared with CI and with
#      local development, so the image cannot drift from the lockfile.
#   2. Only `package.json`, the lockfile, the workspace manifest and `packages/`
#      were copied. But kernel, missions and tools all set
#      `"extends": "../../tsconfig.json"`, so their builds failed on a missing
#      root config. Everything the build actually reads is copied now.
#
# Hardening (P1.11): the container runs as the unprivileged `node` user, state
# directories are created and chowned before the switch, and the healthcheck uses
# node rather than curl (which is not present on alpine and would have to be
# installed just to be probed).
# ============================================================================

# ---------------------------------------------------------------------------
# Stage 1: Base — Node.js + the pinned pnpm
# ---------------------------------------------------------------------------
FROM node:20-alpine AS base

# Pinned, not `latest`: must match package.json "packageManager" and CI's
# PNPM_VERSION, or --frozen-lockfile rejects the lockfile.
ARG PNPM_VERSION=8.15.0
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

WORKDIR /app

# ---------------------------------------------------------------------------
# Stage 2: Builder — install deps and build every package
# ---------------------------------------------------------------------------
FROM base AS builder

# Manifests first so dependency installation stays cached across source changes.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
# Root config and scripts that package builds read (three packages extend
# ../../tsconfig.json; the workspace gates live in scripts/).
COPY eslint.config.mjs ./
COPY scripts/ ./scripts/
COPY packages/ ./packages/

RUN pnpm install --frozen-lockfile
RUN pnpm build

# ---------------------------------------------------------------------------
# Stage 3: Runtime — AGI OS core
# ---------------------------------------------------------------------------
# NOTE: this still carries the full node_modules tree, including devDependencies.
# Trimming to production-only dependencies across a 58-package workspace needs
# `pnpm deploy` per entrypoint; tracked as P1.11 follow-up rather than faked here.
FROM base AS runtime

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-lock.yaml ./
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/tsconfig.json ./
COPY --from=builder /app/scripts ./scripts

# Created and owned BEFORE dropping privileges, so the runtime user can write
# state without the image needing a world-writable directory.
RUN mkdir -p /app/data /app/logs && chown -R node:node /app/data /app/logs

ENV NODE_ENV=production
ENV MAX_SPEND=0

EXPOSE 3001

USER node

# The real CLI entrypoint (packages/cli/src/main.ts). The previous CMD invoked
# `node --import tsx`, but tsx is not a dependency of anything in this workspace,
# so the container could not have started. A long-running cognitive loop arrives
# with the composition root (P2.2); until then this reports real system state and
# exits with a code that reflects it.
CMD ["node", "packages/cli/dist/main.js", "status"]

# No curl on alpine — probe with node, which is already here.
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD node packages/cli/dist/main.js status --json > /dev/null || exit 1

# ---------------------------------------------------------------------------
# Stage 4: Dashboard — Next.js web UI
# ---------------------------------------------------------------------------
FROM base AS dashboard

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-lock.yaml ./
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/tsconfig.json ./

ENV NODE_ENV=production
ENV MAX_SPEND=0
ENV PORT=3000

EXPOSE 3000

USER node

WORKDIR /app/packages/dashboard

# `next start` serves the .next output produced by the builder's `pnpm build`.
CMD ["pnpm", "start"]

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
