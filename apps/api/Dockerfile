# syntax=docker/dockerfile:1.7

# --- Stage 1: install deps (workspace-aware)
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /repo

RUN corepack enable && corepack prepare pnpm@10.30.3 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/dashboard/package.json ./apps/dashboard/
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/
COPY packages/ai/package.json ./packages/ai/
COPY packages/kb/package.json ./packages/kb/
COPY packages/uazapi/package.json ./packages/uazapi/

RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# --- Stage 2: copy source + generate Prisma client
FROM deps AS build
COPY packages ./packages
COPY apps/api ./apps/api
RUN pnpm --filter @imuniza/db db:generate

# --- Stage 3: runtime
FROM node:22-alpine AS runtime
RUN apk add --no-cache libc6-compat openssl tini
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.30.3 --activate

ENV NODE_ENV=production
ENV PORT=3001

# Copia o workspace inteiro (preserva symlinks do pnpm em apps/api/node_modules)
COPY --from=build /repo ./

RUN addgroup -S app -g 1001 && adduser -S app -u 1001 -G app \
    && chown -R app:app /app
USER app

EXPOSE 3001
ENTRYPOINT ["/sbin/tini", "--"]
# Aplica migrations pendentes antes de subir o servidor.
# Tolera falha do migrate (loga e segue) para nao crashar o container
# se a migration ja estiver aplicada e o estado do _prisma_migrations
# divergir entre deploys.
CMD ["sh", "-c", "cd /app/packages/db && pnpm exec prisma migrate deploy || echo '[boot] migrate deploy fallback' ; cd /app && pnpm --filter @imuniza/api run start:prod"]
