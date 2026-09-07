#!/usr/bin/env bun

import { fetchYouTubeInfo, downloadYouTubeAudio } from "../youtube";

const broadcasterUrl = Bun.env.BROADCASTER_URL ?? "";
const providerToken = Bun.env.PROVIDER_TOKEN ?? "";
const downloadDir = Bun.env.PROVIDER_DOWNLOAD_DIR ?? "./provider-downloads";
const audioQuality = Bun.env.AUDIO_QUALITY ?? "5";
const ytDlpRetries = Number.isFinite(Number(Bun.env.PROVIDER_YTDLP_RETRIES))
  ? Number(Bun.env.PROVIDER_YTDLP_RETRIES)
  : 5;
const ytDlpFragmentRetries = Number.isFinite(Number(Bun.env.PROVIDER_YTDLP_FRAGMENT_RETRIES))
  ? Number(Bun.env.PROVIDER_YTDLP_FRAGMENT_RETRIES)
  : 10;
const ytDlpRetrySleep = Bun.env.PROVIDER_YTDLP_RETRY_SLEEP ?? "1";

if (!broadcasterUrl || !providerToken) {
  console.error("BROADCASTER_URL and PROVIDER_TOKEN are required");
  process.exit(1);
}

await Bun.$`mkdir -p ${downloadDir}`;

const baseUrl = new URL(broadcasterUrl);
const wsUrl = new URL("/provider", baseUrl);
wsUrl.protocol = wsUrl.protocol === "https:" ? "wss:" : "ws:";
wsUrl.searchParams.set("token", providerToken);
interface RequestTrack {
  type: "request_track";
  request_id: string;
  source_id: string;
  url: string;
}

const queue: RequestTrack[] = [];
let processing = false;

const ws = new WebSocket(wsUrl.toString());

ws.onopen = () => {
  ws.send(JSON.stringify({ type: "hello", token: providerToken }));
  console.log("[provider] connected");
};

ws.onclose = () => {
  console.log("[provider] disconnected");
};

ws.onerror = (error) => {
  console.error("[provider] websocket error", error);
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data as string) as RequestTrack;
  if (message.type !== "request_track") return;
  queue.push(message);
  void runQueue();
};

async function runQueue(): Promise<void> {
  if (processing) return;
  processing = true;

  while (queue.length > 0) {
    const request = queue.shift();
    if (!request) continue;
    await handleRequest(request).catch((error) => {
      console.error("[provider] request failed", error);
      ws.send(
        JSON.stringify({
          type: "track_error",
          request_id: request.request_id,
          source_id: request.source_id,
          message: error?.message ?? "unknown error",
        })
      );
    });
  }

  processing = false;
}

async function handleRequest(request: RequestTrack): Promise<void> {
  const info = await fetchYouTubeInfo(request.url);
  ws.send(
    JSON.stringify({
      type: "track_info",
      request_id: request.request_id,
      source_id: request.source_id,
      source_url: info.url,
      title: info.title,
      uploader: info.uploader,
      duration_sec: info.duration_sec,
    })
  );

  const filePath = await downloadYouTubeAudio(info.url, request.source_id, {
    directory: downloadDir,
    quality: audioQuality,
    retry: {
      attempts: ytDlpRetries,
      fragments: ytDlpFragmentRetries,
      sleep: ytDlpRetrySleep,
    },
  });

  console.log(`[provider] uploading ${request.source_id}.mp3`);
  await uploadFileOverWebSocket(request.source_id, filePath);
  console.log(`[provider] upload ok ${request.source_id}.mp3`);

  ws.send(
    JSON.stringify({
      type: "track_uploaded",
      request_id: request.request_id,
      source_id: request.source_id,
    })
  );

  await Bun.file(filePath).delete();
}

async function uploadFileOverWebSocket(sourceId: string, filePath: string): Promise<void> {
  ws.send(JSON.stringify({ type: "upload_start", source_id: sourceId }));

  const stream = Bun.file(filePath).stream();
  const reader = stream.getReader();

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) ws.send(value);
  }

  ws.send(JSON.stringify({ type: "upload_end", source_id: sourceId }));
}
