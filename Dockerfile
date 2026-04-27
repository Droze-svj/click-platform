# Multi-stage Dockerfile for Click
#
# Why debian-bookworm-slim instead of alpine:
#   The auto-edit pipeline composes complex ffmpeg filter chains (drawtext,
#   drawbox, boxblur, scale+crop+overlay, setpts, complex_filter graphs).
#   Alpine's `apk add ffmpeg` ships a stripped GPL-free build that returns
#   "Filter not found" on these — same error the dev environment hit. Debian's
#   `apt-get install ffmpeg` ships the full GPL build with libfreetype +
#   libfontconfig + libass already linked.

# Stage 1: Build frontend
FROM node:20-bookworm-slim AS frontend-builder
WORKDIR /app/client
COPY client/package*.json ./
COPY pnpm-lock.yaml ../pnpm-lock.yaml 2>/dev/null || true
RUN npm install -g pnpm@9 && pnpm install --frozen-lockfile=false --prefer-frozen-lockfile
COPY client/ ./
RUN pnpm run build

# Stage 2: Production runtime
FROM node:20-bookworm-slim
WORKDIR /app

# System deps for video processing + native canvas/sharp build.
# fonts-liberation = baseline fonts for ffmpeg drawtext.
# fontconfig       = needed for `fontfile=` resolution in drawtext.
# libfreetype6     = freetype rendering for caption overlays.
# libass9          = subtitle rendering (ASS/SSA) used by exports.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg \
      python3 \
      make \
      g++ \
      pkg-config \
      libcairo2-dev \
      libjpeg-dev \
      libpango1.0-dev \
      libgif-dev \
      librsvg2-dev \
      fonts-liberation \
      fontconfig \
      libfreetype6 \
      libass9 \
      ca-certificates \
      curl \
   && rm -rf /var/lib/apt/lists/*

# Verify ffmpeg has the filters Click depends on. Fail the image build if a
# filter is missing — this turns a runtime 500 into a clear deploy-time error.
RUN ffmpeg -hide_banner -filters 2>&1 | grep -E "drawtext|drawbox|boxblur|setpts|scale" >/dev/null \
   || (echo "FATAL: ffmpeg in this image is missing required filters" && exit 1)

# Server deps — production-only.
COPY package*.json ./
RUN npm install -g pnpm@9 && pnpm install --frozen-lockfile=false --prefer-frozen-lockfile --prod

# Server source.
COPY server/ ./server/

# Built frontend artifacts.
COPY --from=frontend-builder /app/client/.next ./client/.next
COPY --from=frontend-builder /app/client/public ./client/public
COPY --from=frontend-builder /app/client/package.json ./client/package.json

# Writable directories the server creates lazily.
RUN mkdir -p uploads/videos uploads/clips uploads/thumbnails uploads/music uploads/quotes logs

ENV NODE_ENV=production
EXPOSE 5001

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5001/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "server/index.js"]
