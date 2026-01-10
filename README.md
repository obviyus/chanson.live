# chanson.live

Shared low-latency radio. Single stream, many listeners.

## Stack
- Bun server
- mediasoup (WebRTC SFU)
- yt-dlp + ffmpeg (audio ingest)
- bun:sqlite (queue + history)

## Run (local)
- Install: `ffmpeg`, `yt-dlp`
- `bun install`
- `bun run dev`
- Open: `http://localhost:3000`

## Run (Docker, recommended)
- Linux host (VPS):
  - `docker compose build`
  - `docker compose up`
- Uses `network_mode: host` for UDP range.

## Test flow
- `bun run test:e2e "https://www.youtube.com/watch?v=..."`
- Open `http://localhost:3000/test`

## Env
```
PORT=3000
MEDIASOUP_ANNOUNCED_IP=PUBLIC_IP
MEDIASOUP_LISTEN_IP=0.0.0.0
RTC_MIN_PORT=10000
RTC_MAX_PORT=20000

# STUN (defaults to Google if unset)
STUN_URLS=stun:stun.l.google.com:19302
```

## Notes
- `MEDIASOUP_ANNOUNCED_IP` must be your VPS public IP for clients to connect.
- STUN helps NAT discovery but does not relay media. Some networks will fail without TURN.
- Docker uses host networking; no port mapping required in compose.
