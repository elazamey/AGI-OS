# --- Stage 1: Build ---
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/workspace/package.json ./apps/workspace/

RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm --filter @agi-os/workspace build

# --- Stage 2: Serve ---
FROM nginx:alpine AS runner

COPY --from=builder /app/apps/workspace/dist /usr/share/nginx/html

RUN echo 'server { \
    listen 80; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html index.htm; \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
