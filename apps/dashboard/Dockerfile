# syntax=docker/dockerfile:1.7

# --- Stage 1: deps
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@10.30.3 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/dashboard/package.json ./apps/dashboard/
COPY packages/shared/package.json ./packages/shared/

RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter @imuniza/dashboard... --filter @imuniza/shared

# --- Stage 2: build
FROM deps AS build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_OUTPUT_TRACING_ROOT=/repo
ENV NEXT_OUTPUT_STANDALONE=true
COPY packages/shared ./packages/shared
COPY apps/dashboard ./apps/dashboard

# API_BASE_URL is only needed at runtime for the rewrite proxy; at build we pass a placeholder.
ENV API_BASE_URL=http://api:3001
RUN pnpm --filter @imuniza/dashboard build

# --- Stage 3: runtime (minimal)
FROM node:22-alpine AS runtime
RUN apk add --no-cache libc6-compat tini
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup -S app -g 1001 && adduser -S app -u 1001 -G app

COPY --from=build /repo/apps/dashboard/.next/standalone ./
COPY --from=build /repo/apps/dashboard/.next/static ./apps/dashboard/.next/static
COPY --from=build /repo/apps/dashboard/public ./apps/dashboard/public

RUN chown -R app:app /app
USER app

EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/dashboard/server.js"]
