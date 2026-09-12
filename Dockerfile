FROM node:20-alpine AS base
RUN npm install -g pnpm

WORKDIR /app

# Copy workspace configurations and package definitions
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/ ./packages/

# Install dependencies and run build
RUN pnpm install --frozen-lockfile
RUN pnpm build

# Create data directory for local vector persistence
RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV MAX_SPEND_LIMIT=0

CMD ["pnpm", "test"]
