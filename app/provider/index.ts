#!/usr/bin/env bun

import { join } from "path";

const broadcasterUrl = Bun.env.BROADCASTER_URL ?? "";
const providerToken = Bun.env.PROVIDER_TOKEN ?? "";
const downloadDir = Bun.env.PROVIDER_DOWNLOAD_DIR ?? "./provider-downloads";
const audioQuality = Bun.env.AUDIO_QUALITY ?? "5";

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

  const filePath = await downloadYouTubeAudio(info.url, request.source_id);

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

interface YouTubeInfo {
  url: string;
  title: string;
  uploader: string | null;
  duration_sec: number | null;
}

async function fetchYouTubeInfo(url: string): Promise<YouTubeInfo> {
  const proc = Bun.spawn([
    "yt-dlp",
    "--dump-json",
    "--skip-download",
    "--no-playlist",
    "--no-warnings",
    url,
  ], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    throw new Error(`yt-dlp failed (${exitCode}): ${stderr.trim() || "unknown error"}`);
  }

  const line = stdout.trim().split("\n").pop();
  if (!line) throw new Error("yt-dlp returned empty output");

  const info = JSON.parse(line) as {
    title: string;
    uploader?: string;
    channel?: string;
    duration?: number;
    webpage_url?: string;
  };

  return {
    url: info.webpage_url ?? url,
    title: info.title,
    uploader: info.uploader ?? info.channel ?? null,
    duration_sec: typeof info.duration === "number" ? info.duration : null,
  };
}

async function downloadYouTubeAudio(url: string, id: string): Promise<string> {
  const outputTemplate = join(downloadDir, `${id}.%(ext)s`);

  const proc = Bun.spawn([
    "yt-dlp",
    "-x",
    "--audio-format",
    "mp3",
    "--audio-quality",
    audioQuality,
    "--no-playlist",
    "--no-warnings",
    "-o",
    outputTemplate,
    url,
  ], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    throw new Error(`yt-dlp download failed (${exitCode}): ${stderr.trim() || stdout.trim()}`);
  }

  const expectedPath = join(downloadDir, `${id}.mp3`);
  if (!(await Bun.file(expectedPath).exists())) {
    throw new Error("yt-dlp finished but output file missing");
  }

  return expectedPath;
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
