# ---------- Build ----------
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

# ---------- Laufzeit ----------
FROM node:24-alpine
# tzdata: österreichische Zeit für Termine, Fristen und Rechnungen
RUN apk add --no-cache tzdata && mkdir -p /data && chown node:node /data
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    DATA_DIR=/data \
    TZ=Europe/Vienna \
    BODY_SIZE_LIMIT=60M
COPY --from=build --chown=node:node /app/build ./build
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/drizzle ./drizzle
COPY --from=build --chown=node:node /app/scripts ./scripts
COPY --from=build --chown=node:node /app/package.json ./
# Gleicher Benutzer (uid 1000) wie die Webseite – beide schreiben ins selbe Volume
USER node
VOLUME ["/data"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1
CMD ["node", "build"]
