# Haven: production image for Google Cloud Run (see docs/MISE-EN-PRODUCTION.md).

# 1. Build the site with every tool (Vite, Tailwind, TypeScript).
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# Public browser key, compiled into the site (optional).
ARG GOOGLE_MAPS_PLATFORM_KEY=
ENV GOOGLE_MAPS_PLATFORM_KEY=$GOOGLE_MAPS_PLATFORM_KEY
RUN npm run build

# 2. Run the server with production dependencies only.
FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production \
    TZ=Europe/Paris \
    PORT=8080
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY . .
COPY --from=build /app/dist ./dist
USER node
EXPOSE 8080
# node directly (not npm): Cloud Run's SIGTERM reaches the server, which saves the audience totals before stopping.
CMD ["node", "--import", "tsx", "server.ts"]
