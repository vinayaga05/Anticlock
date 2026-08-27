# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/contracts/package.json packages/contracts/
COPY packages/tsconfig/package.json packages/tsconfig/
COPY apps/admin/package.json apps/admin/
RUN pnpm install --filter @anticlock/admin... --frozen-lockfile

FROM base AS build
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
COPY --from=deps /app /app
COPY packages/tsconfig packages/tsconfig
COPY packages/contracts packages/contracts
COPY apps/admin apps/admin
RUN pnpm --filter @anticlock/contracts build \
  && pnpm --filter @anticlock/admin build

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN apk add --no-cache wget
WORKDIR /app

# Next standalone output
COPY --from=build /app/apps/admin/public ./apps/admin/public
COPY --from=build /app/apps/admin/.next/standalone ./
COPY --from=build /app/apps/admin/.next/static ./apps/admin/.next/static

USER node
EXPOSE 3000
CMD ["node", "apps/admin/server.js"]
