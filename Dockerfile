FROM oven/bun:latest

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    gnupg \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get update \
    && apt-get install -y --no-install-recommends \
    nodejs \
    ffmpeg \
    yt-dlp \
    python3 \
    python3-pip \
    build-essential \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

COPY package.json bun.lock tsconfig.json bunfig.toml ./
COPY app ./app

RUN bun install --frozen-lockfile

ENV PORT=3000
ENV MEDIASOUP_LISTEN_IP=0.0.0.0
ENV RTC_MIN_PORT=10000
ENV RTC_MAX_PORT=20000

CMD ["/bin/bash", "-lc", "if [ ! -x /app/node_modules/mediasoup/worker/out/Release/mediasoup-worker ]; then (cd /app/node_modules/mediasoup && node npm-scripts.mjs postinstall); fi; export MEDIASOUP_ANNOUNCED_IP=${MEDIASOUP_ANNOUNCED_IP:-$(curl -s https://icanhazip.com | tr -d '\\n')}; exec bun run app/server/index.ts"]
