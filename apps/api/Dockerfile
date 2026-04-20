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

# --- Stage 2: generate Prisma client (needs schema + node_modules)
FROM deps AS prisma
COPY packages/db ./packages/db
RUN pnpm --filter @imuniza/db db:generate

# --- Stage 3: runtime
FROM node:22-alpine AS runtime
RUN apk add --no-cache libc6-compat openssl tini
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.30.3 --activate

ENV NODE_ENV=production
ENV PORT=3001

# Full workspace copy for tsx runtime (simpler than building every package)
COPY --from=prisma /repo/node_modules ./node_modules
COPY --from=prisma /repo/package.json ./
COPY --from=prisma /repo/pnpm-workspace.yaml ./
COPY --from=prisma /repo/tsconfig.base.json ./
COPY --from=prisma /repo/packages ./packages
COPY apps/api ./apps/api

RUN addgroup -S app -g 1001 && adduser -S app -u 1001 -G app \
    && chown -R app:app /app
USER app

EXPOSE 3001
ENTRYPOINT ["/sbin/tini", "--"]
# Invoca tsx via pnpm no workspace @imuniza/api (pnpm sabe resolver o bin dele).
CMD ["pnpm", "--filter", "@imuniza/api", "run", "start:prod"]
