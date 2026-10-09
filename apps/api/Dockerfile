# NestJS api, built from the repository root:
#   docker build -f apps/api/Dockerfile .
# The image also carries the migrations: `node dist/database/migrate.js` reads
# /app/migrations. `files` in apps/api/package.json decides what `pnpm deploy` copies.

FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo

# Dependencies first, so source changes reuse this layer.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --filter '@onetickets/api...'

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @onetickets/shared build \
 && pnpm --filter @onetickets/api build \
 && pnpm --filter @onetickets/api deploy --prod --legacy /out

FROM node:22-alpine
ENV NODE_ENV=production \
    PORT=3001
WORKDIR /app
COPY --from=build --chown=node:node /out ./
USER node
EXPOSE 3001
CMD ["node", "dist/main.js"]
