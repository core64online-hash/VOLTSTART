# API (NestJS). Збирається з кореня монорепо:
#   docker build -f apps/api/Dockerfile -t voltstar-api .
# Той самий образ виконує службові команди: міграції (`npx prisma migrate deploy`),
# seed, очищення за строками зберігання, переіндексацію пошуку.

# ─── Build stage ───────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages ./packages
COPY apps/api ./apps/api
RUN pnpm install --frozen-lockfile --filter @voltstar/api...
RUN pnpm --filter @voltstar/api prisma:generate
# @voltstar/types потрібен у рантаймі як зібраний CommonJS.
RUN pnpm --filter @voltstar/types build
RUN pnpm --filter @voltstar/api build

# ─── Runtime stage ─────────────────────────────────────────────
FROM node:22-alpine AS runtime
WORKDIR /app
ARG APP_VERSION=dev
ARG APP_COMMIT=unknown
ENV NODE_ENV=production \
    API_PORT=4000 \
    APP_VERSION=${APP_VERSION} \
    APP_COMMIT=${APP_COMMIT}
# libssl3 для рушія Prisma вже є в node:22-alpine.
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/packages ./packages
COPY --from=build --chown=app:app /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build --chown=app:app /app/apps/api/dist ./apps/api/dist
COPY --from=build --chown=app:app /app/apps/api/prisma ./apps/api/prisma
COPY --from=build --chown=app:app /app/apps/api/src ./apps/api/src
COPY --from=build --chown=app:app /app/apps/api/tsconfig.json ./apps/api/tsconfig.json
# Шрифти з кирилицею для PDF-документів.
COPY --from=build --chown=app:app /app/apps/api/assets ./apps/api/assets
COPY --from=build --chown=app:app /app/apps/api/package.json ./apps/api/package.json
USER app
WORKDIR /app/apps/api
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/api/health/ready >/dev/null || exit 1
CMD ["node", "dist/src/main.js"]
