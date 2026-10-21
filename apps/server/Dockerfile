# Built from the repo root: docker build -f apps/server/Dockerfile -t vega-server .
# syntax=docker/dockerfile:1
FROM node:24-slim AS base
WORKDIR /repo
ENV HUSKY=0

FROM base AS deps
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY apps/server/package.json ./apps/server/
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/
RUN npm pkg delete scripts.prepare && npm ci

FROM base AS runtime
ENV NODE_ENV=production
ENV PORT=8080
ENV FIRESTORE_DB="(default)"
ENV PROJECT_ID=vega-life-os
COPY --from=deps /repo/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY packages/shared ./packages/shared
COPY apps/server ./apps/server
ARG GIT_SHA=dev
ENV GIT_SHA=$GIT_SHA
WORKDIR /repo/apps/server
EXPOSE 8080
CMD ["npx", "tsx", "src/index.ts"]
