#!/usr/bin/env bun
/**
 * Test script to verify audio streaming works.
 *
 * Usage:
 *   bun run test:stream              # Stream a test tone
 *   bun run test:stream <file.opus>  # Stream a specific file
 *
 * Then open http://localhost:3000/test in your browser.
 */

import { mediasoupHandler } from "./mediasoup";
import { websocketHandler, upgradeToWebSocket, broadcastNowPlaying } from "./websocket";

import { resolve, dirname } from "path";
import { existsSync } from "fs";

const PORT = parseInt(Bun.env.PORT ?? "3000");

// Resolve file path - try multiple locations since bun workspace changes cwd
function resolveTestFile(arg: string | undefined): string | undefined {
  if (!arg) return undefined;

  // If absolute path, use as-is
  if (arg.startsWith("/")) return arg;

  // Try relative to cwd first
  const fromCwd = resolve(process.cwd(), arg);
  if (existsSync(fromCwd)) return fromCwd;

  // Try relative to project root (2 levels up from this script)
  const projectRoot = resolve(dirname(import.meta.path), "../..");
  const fromRoot = resolve(projectRoot, arg);
  if (existsSync(fromRoot)) return fromRoot;

  // Return the fromRoot path anyway, let the error handling catch it
  return fromRoot;
}

const testFile = resolveTestFile(Bun.argv[2]);

// Test page HTML - must be defined before Bun.serve()
const testPageHtml = `<!DOCTYPE html>
<html>
<head>
  <title>chanson.live - Stream Test</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 600px;
      margin: 40px auto;
      padding: 20px;
      background: #111;
      color: #fff;
    }
    h1 { color: #fff; margin-bottom: 8px; }
    .subtitle { color: #888; margin-bottom: 24px; }
    .status {
      padding: 12px 16px;
      border-radius: 8px;
      margin: 12px 0;
      font-size: 14px;
    }
    .status.connected { background: #1a3d1a; border: 1px solid #2d5a2d; }
    .status.disconnected { background: #3d1a1a; border: 1px solid #5a2d2d; }
    .status.waiting { background: #3d3d1a; border: 1px solid #5a5a2d; }
    .now-playing {
      background: #1a1a2e;
      border-radius: 12px;
      padding: 20px;
      margin: 20px 0;
    }
    .now-playing h2 { margin: 0 0 4px 0; }
    .now-playing .artist { color: #888; margin: 0; }
    button {
      background: #4a4aff;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 16px;
      margin: 8px 4px;
    }
    button:hover { background: #5a5aff; }
    button:disabled { background: #333; cursor: not-allowed; }
    #log {
      background: #0a0a0a;
      border: 1px solid #333;
      border-radius: 8px;
      padding: 12px;
      font-family: monospace;
      font-size: 12px;
      max-height: 300px;
      overflow-y: auto;
      margin-top: 20px;
    }
    .log-entry { margin: 4px 0; }
    .log-entry.error { color: #ff6b6b; }
    .log-entry.success { color: #6bff6b; }
    audio { width: 100%; margin: 16px 0; }
    .client-count { color: #888; font-size: 14px; }
  </style>
</head>
<body>
  <h1>chanson.live Stream Test</h1>
  <p class="subtitle">Testing WebRTC audio streaming</p>

  <div id="connectionStatus" class="status disconnected">Disconnected</div>

  <div class="now-playing" id="nowPlaying" style="display: none;">
    <h2 id="title">-</h2>
    <p class="artist" id="artist">-</p>
  </div>

  <div>
    <button id="connectBtn">Connect & Play</button>
  </div>

  <p class="client-count">Listeners: <span id="clientCount">0</span></p>

  <audio id="audio" controls></audio>

  <div id="log"></div>

  <script type="module">
    import * as mediasoupClient from 'https://esm.sh/mediasoup-client@3.18.3';

    const log = (msg, type = '') => {
      const el = document.getElementById('log');
      const entry = document.createElement('div');
      entry.className = 'log-entry ' + type;
      entry.textContent = new Date().toLocaleTimeString() + ' ' + msg;
      el.appendChild(entry);
      el.scrollTop = el.scrollHeight;
      console.log(msg);
    };

    const setStatus = (text, type) => {
      const el = document.getElementById('connectionStatus');
      el.textContent = text;
      el.className = 'status ' + type;
    };

    let ws = null;
    let device = null;
    let transport = null;
    let consumer = null;
    let pendingDtlsCallback = null;

    const audioEl = document.getElementById('audio');
    const connectBtn = document.getElementById('connectBtn');

    connectBtn.onclick = connect;

    async function connect() {
      if (ws) {
        ws.close();
        return;
      }

      setStatus('Connecting...', 'waiting');
      ws = new WebSocket('ws://' + location.host + '/ws');

      ws.onopen = () => {
        log('WebSocket connected', 'success');
        setStatus('Connected', 'connected');
        connectBtn.textContent = 'Disconnect';
        ws.send(JSON.stringify({ type: 'get_rtp_capabilities' }));
      };

      ws.onclose = () => {
        log('WebSocket disconnected');
        setStatus('Disconnected', 'disconnected');
        connectBtn.textContent = 'Connect & Play';
        ws = null;
        device = null;
        transport = null;
      };

      ws.onerror = (e) => log('WebSocket error', 'error');

      ws.onmessage = async (e) => {
        const msg = JSON.parse(e.data);
        log('Received: ' + msg.type);

        switch (msg.type) {
          case 'welcome':
            log('Client ID: ' + msg.id, 'success');
            break;

          case 'client_count':
            document.getElementById('clientCount').textContent = msg.count;
            break;

          case 'rtp_capabilities':
            device = new mediasoupClient.Device();
            await device.load({ routerRtpCapabilities: msg.capabilities });
            log('Device loaded', 'success');
            ws.send(JSON.stringify({ type: 'create_transport' }));
            break;

          case 'transport_created':
            transport = device.createRecvTransport(msg.params);
            transport.on('connect', ({ dtlsParameters }, callback, errback) => {
              pendingDtlsCallback = { callback, errback };
              ws.send(JSON.stringify({ type: 'connect_transport', dtlsParameters }));
            });
            log('Transport created', 'success');
            ws.send(JSON.stringify({ type: 'consume', rtpCapabilities: device.rtpCapabilities }));
            break;

          case 'transport_connected':
            if (pendingDtlsCallback) {
              pendingDtlsCallback.callback();
              pendingDtlsCallback = null;
            }
            log('Transport connected', 'success');
            break;

          case 'producer_started':
            log('Producer started!', 'success');
            if (transport && device) {
              ws.send(JSON.stringify({ type: 'consume', rtpCapabilities: device.rtpCapabilities }));
            }
            break;

          case 'producer_closed':
            log('Producer closed', 'error');
            audioEl.srcObject = null;
            break;

          case 'consumed':
            consumer = await transport.consume({
              id: msg.params.id,
              producerId: msg.params.producerId,
              kind: 'audio',
              rtpParameters: msg.params.rtpParameters,
            });
            const stream = new MediaStream([consumer.track]);
            audioEl.srcObject = stream;
            try {
              await audioEl.play();
              log('Audio playing!', 'success');
              setStatus('Playing', 'connected');
            } catch (e) {
              log('Click the audio controls to play', 'error');
            }
            break;

          case 'now_playing':
            if (msg.song) {
              document.getElementById('nowPlaying').style.display = 'block';
              document.getElementById('title').textContent = msg.song.title;
              document.getElementById('artist').textContent = msg.song.artist;
            } else {
              document.getElementById('nowPlaying').style.display = 'none';
            }
            break;

          case 'error':
            log('Error: ' + msg.message, 'error');
            break;
        }
      };
    }

    // Auto-connect on load
    setTimeout(connect, 500);
  </script>
</body>
</html>`;

console.log("=== chanson.live Stream Test ===\n");

// Initialize mediasoup
console.log("[test] Initializing mediasoup...");
await mediasoupHandler.initialize();

// Start server
const server = Bun.serve({
  port: PORT,
  fetch(req, server) {
    const url = new URL(req.url);

    if (url.pathname === "/ws") {
      return upgradeToWebSocket(req, server) ?? new Response(null, { status: 101 });
    }

    if (url.pathname === "/" || url.pathname === "/test") {
      return new Response(testPageHtml, {
        headers: { "Content-Type": "text/html" },
      });
    }

    return new Response("Not Found", { status: 404 });
  },
  websocket: websocketHandler,
});

console.log(`[test] Server running at http://localhost:${PORT}`);
console.log(`[test] Open http://localhost:${PORT}/test in your browser\n`);

// Start producer
console.log("[test] Creating mediasoup producer...");
const { rtpPort, rtcpPort } = await mediasoupHandler.createDefaultProducer();
console.log(`[test] Producer ready. RTP: ${rtpPort}, RTCP: ${rtcpPort}\n`);

// Broadcast fake now playing
broadcastNowPlaying({
  id: 0,
  spotify_id: "test",
  title: testFile ? testFile.split("/").pop()! : "Test Tone (440Hz)",
  artist: "Test",
  album: "Stream Test",
  cover_url: "https://via.placeholder.com/300",
  duration_ms: null,
  file_path: testFile ?? null,
});

// Start ffmpeg
let ffmpegArgs: string[];

if (testFile) {
  // Check file exists
  const file = Bun.file(testFile);
  if (!(await file.exists())) {
    console.error(`[test] Error: File not found: ${testFile}`);
    process.exit(1);
  }
  // Stream provided file
  console.log(`[test] Streaming file: ${testFile}`);
  ffmpegArgs = [
    "ffmpeg",
    "-nostats",
    "-loglevel", "warning",
    "-re",
    "-i", testFile,
    "-map", "0:a",
    "-c:a", "libopus",
    "-ar", "48000",
    "-ac", "2",
    "-ssrc", "11111111",
    "-payload_type", "101",
    "-f", "rtp",
    `rtp://127.0.0.1:${rtpPort}?rtcpport=${rtcpPort}`,
  ];
} else {
  // Generate test tone
  console.log("[test] Generating 440Hz test tone (sine wave)");
  ffmpegArgs = [
    "ffmpeg",
    "-nostats",
    "-loglevel", "warning",
    "-re",
    "-f", "lavfi",
    "-i", "sine=frequency=440:duration=300",  // 5 minute 440Hz tone
    "-c:a", "libopus",
    "-ar", "48000",
    "-ac", "2",
    "-ssrc", "11111111",
    "-payload_type", "101",
    "-f", "rtp",
    `rtp://127.0.0.1:${rtpPort}?rtcpport=${rtcpPort}`,
  ];
}

console.log(`[test] Running: ${ffmpegArgs.join(" ")}\n`);

const proc = Bun.spawn(ffmpegArgs, {
  stdout: "inherit",
  stderr: "inherit",
});

console.log(`[test] ffmpeg started: pid=${proc.pid}`);
console.log("[test] Press Ctrl+C to stop\n");

// Handle shutdown
process.on("SIGINT", async () => {
  console.log("\n[test] Shutting down...");
  proc.kill();
  await proc.exited;
  mediasoupHandler.closeProducer();
  server.stop();
  process.exit(0);
});

// Wait for ffmpeg to complete
await proc.exited;
console.log("[test] Stream ended");
mediasoupHandler.closeProducer();
server.stop();
