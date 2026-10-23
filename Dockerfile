# Stage 1: Build Frontend Assets
FROM node:20-alpine AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install --legacy-peer-deps
COPY client/ ./
COPY shared/ /app/shared/
RUN npm run build

# Stage 2: Production Application Runner
FROM node:20-alpine
WORKDIR /app

# Install system dependencies: ffmpeg, python3, curl
RUN apk add --no-cache ffmpeg python3 curl bash

# Install latest yt-dlp binary
RUN mkdir -p /app/server/bin && \
    curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /app/server/bin/yt-dlp && \
    chmod +x /app/server/bin/yt-dlp

# Ensure local bin is on PATH
ENV PATH="/app/server/bin:${PATH}"

# Install server dependencies
WORKDIR /app/server
COPY server/package*.json ./
RUN npm install --omit=dev --legacy-peer-deps

# Copy server code and shared constants
COPY server/ ./
COPY shared/ /app/shared/

# Copy compiled frontend from builder
COPY --from=client-builder /app/client/dist /app/client/dist

# Production environment defaults
ENV NODE_ENV=production
ENV PORT=5000
ENV DOWNLOAD_DIR=/app/server/downloads/temp

EXPOSE 5000

CMD ["node", "src/server.js"]
