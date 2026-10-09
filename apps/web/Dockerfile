# Next.js web app, built from the repository root:
#   docker build -f apps/web/Dockerfile .
# Needs `output: 'standalone'` in apps/web/next.config.ts.

FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo

# Dependencies first, so source changes reuse this layer.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --filter '@onetickets/web...'

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/web apps/web

# Next bakes rewrites and NEXT_PUBLIC_* values in at build time. The same image
# runs in staging and production, so build-time values must not differ between
# them: API_URL is the API's private address, identical in every environment.
ARG API_URL=http://api.onetickets.internal:3001
ARG NEXT_PUBLIC_SENTRY_DSN=
ENV API_URL=$API_URL \
    NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN \
    NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @onetickets/web build

FROM node:22-alpine
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
# Add `COPY ... /repo/apps/web/public ./apps/web/public` once apps/web/public exists.
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
