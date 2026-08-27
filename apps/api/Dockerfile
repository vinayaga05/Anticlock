# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/contracts/package.json packages/contracts/
COPY packages/tsconfig/package.json packages/tsconfig/
COPY apps/api/package.json apps/api/
RUN pnpm install --filter @anticlock/api... --frozen-lockfile

FROM base AS build
COPY --from=deps /app /app
COPY packages/tsconfig packages/tsconfig
COPY packages/contracts packages/contracts
COPY apps/api apps/api
RUN pnpm --filter @anticlock/contracts build \
  && pnpm --filter @anticlock/api build

FROM base AS runner
ENV NODE_ENV=production
RUN apk add --no-cache wget
WORKDIR /app
COPY --from=build /app /app
COPY apps/api/docker-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh \
  && mkdir -p /app/apps/api/.media \
  && chown -R node:node /app
USER node
WORKDIR /app/apps/api
EXPOSE 4000
ENTRYPOINT ["/entrypoint.sh"]
