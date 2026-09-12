# ============================================================================
# AGI OS — Multi-Stage Dockerfile
# Stages: base → builder → runtime → dashboard
# ============================================================================

# ---------------------------------------------------------------------------
# Stage 1: Base — Node.js + pnpm
# ---------------------------------------------------------------------------
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# ---------------------------------------------------------------------------
# Stage 2: Builder — Install deps + build all packages
# ---------------------------------------------------------------------------
FROM base AS builder
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/ ./packages/
RUN pnpm install --frozen-lockfile
RUN pnpm build

# ---------------------------------------------------------------------------
# Stage 3: Runtime — AGI OS core (tests + cognitive loop)
# ---------------------------------------------------------------------------
FROM base AS runtime
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-lock.yaml ./
COPY --from=builder /app/pnpm-workspace.yaml ./

RUN mkdir -p /app/data /app/logs

ENV NODE_ENV=production
ENV MAX_SPEND=0

EXPOSE 3001

CMD ["node", "--import", "tsx", "-e", "console.log('AGI OS Runtime ready')"]

# ---------------------------------------------------------------------------
# Stage 4: Dashboard — Next.js web UI
# ---------------------------------------------------------------------------
FROM base AS dashboard
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-lock.yaml ./
COPY --from=builder /app/pnpm-workspace.yaml ./

ENV NODE_ENV=production
ENV MAX_SPEND=0
ENV PORT=3000

EXPOSE 3000

WORKDIR /app/packages/dashboard
CMD ["pnpm", "start"]
