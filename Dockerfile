# ═══════════════════════════════════════════════════════
# AGI-OS Dockerfile — Hugging Face Spaces (port 7860)
# ═══════════════════════════════════════════════════════

# Stage 1: Build
FROM node:20-slim AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY tsconfig.json ./
COPY packages ./packages
COPY apps ./apps

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @agi-os/api-gateway build

# Stage 2: Production
FROM node:20-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=7860

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/api-gateway ./packages/api-gateway

EXPOSE 7860

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:7860/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) })"

CMD ["node", "packages/api-gateway/dist/index.js"]
