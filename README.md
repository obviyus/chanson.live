# chanson.live

Shared low-latency radio. One stream, many listeners.

Everyone hears the same thing at the same time. Submit a YouTube link, it gets queued, and when it plays—everyone listening hears it together.

## How It Works

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              chanson.live                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   User submits YouTube URL                                              │
│          │                                                              │
│          ▼                                                              │
│   ┌─────────────┐    ┌──────────────┐    ┌────────────────────┐         │
│   │   yt-dlp    │───▶│    ffmpeg    │───▶│     mediasoup      │         │
│   │  (download) │    │ (mp3→opus)   │    │   (WebRTC SFU)     │         │
│   └─────────────┘    └──────────────┘    └─────────┬──────────┘         │
│                                                    │                    │
│                                                    ▼                    │
│                                          ┌─────────────────┐            │
│                                          │    Listeners    │            │
│                                          │  (synchronized) │            │
│                                          └─────────────────┘            │
└─────────────────────────────────────────────────────────────────────────┘
```

1. **Request** — User submits a YouTube URL via the web interface
2. **Download** — `yt-dlp` fetches the audio (cached for future plays)
3. **Transcode** — `ffmpeg` converts to Opus and streams via RTP
4. **Distribute** — mediasoup (WebRTC SFU) fans out to all connected clients
5. **Listen** — Everyone hears the same audio at the same time

## Stack

| Component | Purpose |
|-----------|---------|
| [Bun](https://bun.sh) | Runtime, HTTP server, WebSocket, SQLite |
| [mediasoup](https://mediasoup.org) | WebRTC Selective Forwarding Unit |
| [yt-dlp](https://github.com/yt-dlp/yt-dlp) | YouTube audio extraction |
| [ffmpeg](https://ffmpeg.org) | Audio transcoding (MP3 → Opus over RTP) |

## Quick Start

### Local Development

```bash
# Prerequisites: ffmpeg, yt-dlp
bun install
bun run dev
# Open http://localhost:3000
```

### Docker (Recommended for Production)

```bash
docker compose build
docker compose up
```

Uses `network_mode: host` for UDP port range (required for WebRTC).

## External Provider Mode

YouTube may block downloads from VPS IP ranges. The **external provider** architecture solves this by running the downloader on a separate machine (e.g., your home network) while the VPS handles only streaming.

```
┌────────────────────┐         WebSocket          ┌────────────────────┐
│    VPS (Server)    │◀──────────────────────────▶│   Home (Provider)  │
│                    │                             │                    │
│  • Serves clients  │    ◀─ track requests ──    │  • Runs yt-dlp     │
│  • WebRTC stream   │    ── audio upload ──▶     │  • Sends audio     │
│  • Queue/history   │                             │  • Avoids blocks   │
└────────────────────┘                             └────────────────────┘
```

### VPS Configuration

```bash
PROVIDER_MODE=external
PROVIDER_TOKEN=your_secure_token
```

### Provider Configuration

```bash
BROADCASTER_URL=https://your-vps-domain
PROVIDER_TOKEN=your_secure_token
PROVIDER_DOWNLOAD_DIR=./provider-downloads
AUDIO_QUALITY=5
```

### Running the Provider

```bash
bun run provider
```

The provider connects to the VPS via WebSocket, receives download requests, fetches audio via `yt-dlp`, and uploads the file back over the same connection.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP server port |
| `PROVIDER_MODE` | `local` | `local` or `external` |
| `PROVIDER_TOKEN` | — | Shared secret for provider auth |
| `MEDIASOUP_ANNOUNCED_IP` | auto | Public IP for WebRTC (required for production) |
| `MEDIASOUP_LISTEN_IP` | `0.0.0.0` | Bind address |
| `RTC_MIN_PORT` | `10000` | WebRTC UDP port range start |
| `RTC_MAX_PORT` | `20000` | WebRTC UDP port range end |
| `STUN_URLS` | Google STUN | ICE server URLs |
| `AUDIO_QUALITY` | `5` | yt-dlp quality (1-10, lower = better) |
| `CACHE_MAX_BYTES` | `5368709120` | Max cache size (5GB) |
| `DOWNLOAD_DIR` | `./downloads` | Audio cache directory |

## Architecture Highlights

### Single Producer, Many Consumers

Unlike per-user streaming, chanson.live uses a **single mediasoup producer** that all clients subscribe to. One `ffmpeg` process streams to one producer, and mediasoup efficiently fans out to hundreds of consumers.

### Smart Cache Management

Downloaded audio is cached locally. When cache exceeds `CACHE_MAX_BYTES`, the oldest files are pruned—but files currently in queue or playing are protected from deletion.

### Fallback Playback

When the queue is empty, the player shuffles through cached tracks automatically, keeping the radio alive.

### RTP Health Monitoring

The server monitors the RTP score every 5 seconds. If `ffmpeg` stops sending audio (score drops to 0), the producer is closed automatically to prevent zombie streams.

### Binary WebSocket Uploads

External providers upload audio as raw binary chunks over WebSocket (not base64), minimizing overhead for large files.

## Testing

```bash
# E2E test with a specific video
bun run test:e2e "https://www.youtube.com/watch?v=..."

# Test page
open http://localhost:3000/test
```

## Notes

- `MEDIASOUP_ANNOUNCED_IP` **must** be your VPS public IP for clients behind NAT to connect
- STUN helps NAT discovery but doesn't relay media—some restrictive networks may need TURN
- SQLite runs in WAL mode for better concurrent read performance
