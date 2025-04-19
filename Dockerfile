# ──────────────────────────────────────────────────────────────────
# Stage 1: Build TS → JS & install node modules
# ──────────────────────────────────────────────────────────────────
FROM node:22.12-alpine AS builder  

WORKDIR /app

COPY package*.json ./
RUN npm ci && npm install -g typescript

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ──────────────────────────────────────────────────────────────────
# Stage 2: Runtime layer
# ──────────────────────────────────────────────────────────────────
FROM node:22-alpine

WORKDIR /app

RUN apk add --no-cache ffmpeg python3 yt-dlp

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package.json .

ENTRYPOINT ["node", "dist/index.js"]
EXPOSE 6274 6277
