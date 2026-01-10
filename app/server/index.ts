import { initDatabase } from "./db/schema";
import { ensureDirectories } from "./fs";
import {
  CACHE_MAX_BYTES,
  DB_PATH,
  DOWNLOAD_DIR,
  PORT,
  PROVIDER_TOKEN,
  STUN_URLS,
} from "./config";
import { websocketHandler, upgradeToWebSocket, createClientData } from "./websocket";
import { initQueue, getQueueSnapshot } from "./queue";
import { handleQueueRequest } from "./requests";
import { Player } from "./player";
import { TEST_PAGE_HTML } from "./test-page";
import { APP_PAGE_HTML } from "./app-page";
import { initProvider, getProviderStatus, updateTrackFileFromUpload } from "./provider";
import { pruneDownloads } from "./cache";
import { getQueue } from "./db/queries";
import { join } from "path";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
};

function json(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
      ...(init.headers ?? {}),
    },
  });
}

await ensureDirectories();

const db = initDatabase(DB_PATH);
initQueue(db);
initProvider(db);

const player = new Player(db);
player.start();

const server = Bun.serve({
  port: PORT,
  fetch(req, server) {
    const url = new URL(req.url);

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (url.pathname === "/ws") {
      const response = upgradeToWebSocket(req, server, createClientData());
      if (response) return response;
      return undefined;
    }

    if (url.pathname === "/provider") {
      if (getProviderStatus().mode !== "external") {
        return new Response("Provider disabled", { status: 404 });
      }
      const token = url.searchParams.get("token") ?? "";
      if (!PROVIDER_TOKEN || token !== PROVIDER_TOKEN) {
        return new Response("Unauthorized", { status: 401 });
      }
      const response = upgradeToWebSocket(req, server, {
        role: "provider",
        token,
        connectedAt: Date.now(),
      });
      if (response) return response;
      return undefined;
    }

    if (url.pathname === "/health") {
      return new Response("ok", { headers: corsHeaders });
    }

    if (url.pathname === "/api/config") {
      return json({
        ice_servers: buildIceServers(),
        provider: getProviderStatus(),
      });
    }

    if (url.pathname === "/test") {
      return new Response(TEST_PAGE_HTML, {
        headers: { "Content-Type": "text/html", ...corsHeaders },
      });
    }

    if (url.pathname === "/") {
      return new Response(APP_PAGE_HTML, {
        headers: { "Content-Type": "text/html", ...corsHeaders },
      });
    }

    if (url.pathname === "/api/queue" && req.method === "GET") {
      return json({ queue: getQueueSnapshot() });
    }

    if (url.pathname === "/api/queue" && req.method === "POST") {
      return handleQueuePost(req).catch((error) => {
        console.error("[api] /api/queue error", error);
        return json({ error: error?.message ?? "internal error" }, { status: 500 });
      });
    }

    if (url.pathname === "/api/now-playing" && req.method === "GET") {
      return json({ now_playing: player.getNowPlaying() });
    }

    if (url.pathname === "/api/skip" && req.method === "POST") {
      player.skip();
      return json({ ok: true });
    }

    if (url.pathname.startsWith("/api/provider/upload/") && req.method === "PUT") {
      return handleProviderUpload(req, url).catch((error) => {
        console.error("[api] provider upload error", error);
        return json({ error: error?.message ?? "internal error" }, { status: 500 });
      });
    }

    return new Response("Not Found", { status: 404 });
  },
  websocket: websocketHandler,
});

console.log(`[server] listening on http://localhost:${server.port}`);

async function handleQueuePost(req: Request): Promise<Response> {
  let body: { url?: string; requested_by?: string };
  try {
    body = (await req.json()) as { url?: string; requested_by?: string };
  } catch {
    return json({ error: "invalid json" }, { status: 400 });
  }
  if (!body.url) {
    return json({ error: "url required" }, { status: 400 });
  }

  try {
    const track = await handleQueueRequest(db, body.url, body.requested_by ?? null);
    return json({ ok: true, track });
  } catch (error) {
    return json({ error: error?.message ?? "request failed" }, { status: 400 });
  }
}

async function handleProviderUpload(req: Request, url: URL): Promise<Response> {
  if (getProviderStatus().mode !== "external") {
    return json({ error: "provider disabled" }, { status: 404 });
  }
  const token = url.searchParams.get("token") ?? "";
  if (!PROVIDER_TOKEN || token !== PROVIDER_TOKEN) {
    return json({ error: "unauthorized" }, { status: 401 });
  }

  const sourceId = url.pathname.split("/").pop();
  if (!sourceId) {
    return json({ error: "missing source id" }, { status: 400 });
  }
  if (!/^[a-zA-Z0-9_-]{11}$/.test(sourceId)) {
    return json({ error: "invalid source id" }, { status: 400 });
  }

  const body = req.body;
  if (!body) {
    return json({ error: "missing body" }, { status: 400 });
  }

  const filePath = join(DOWNLOAD_DIR, `${sourceId}.mp3`);
  const uploadResponse = new Response(body);
  await Bun.write(filePath, uploadResponse);
  const storedSize = (await Bun.file(filePath).stat()).size;
  if (storedSize === 0) {
    await Bun.file(filePath).delete();
    return json({ error: "empty upload" }, { status: 400 });
  }
  console.log(`[provider] upload stored ${sourceId}.mp3 (${storedSize} bytes)`);
  updateTrackFileFromUpload(sourceId, filePath);

  const queue = getQueue(db);
  const protectedIds = new Set<string>(queue.map((item) => item.source_id));
  const nowPlaying = player.getNowPlaying();
  if (nowPlaying) protectedIds.add(nowPlaying.source_id);

  await pruneDownloads(db, CACHE_MAX_BYTES, protectedIds);

  return json({ ok: true });
}

function buildIceServers(): Array<{
  urls: string[] | string;
}> {
  const servers: Array<{
    urls: string[] | string;
  }> = [];

  if (STUN_URLS.length) {
    servers.push({ urls: STUN_URLS });
  }

  return servers;
}
