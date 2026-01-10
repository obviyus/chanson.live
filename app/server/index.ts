import { initDatabase } from "./db/schema";
import { ensureDirectories } from "./fs";
import {
  CACHE_MAX_BYTES,
  DB_PATH,
  DOWNLOAD_DIR,
  PORT,
  ADMIN_TOKEN,
  PROVIDER_TOKEN,
  STUN_URLS,
} from "./config";
import { websocketHandler, upgradeToWebSocket, createClientData } from "./websocket";
import { initQueue, getQueueSnapshot, refreshQueue } from "./queue";
import { handleQueueRequest } from "./requests";
import { Player } from "./player";
import { TEST_PAGE_HTML } from "./test-page";
import { APP_PAGE_HTML } from "./app-page";
import { initProvider, getProviderStatus, updateTrackFileFromUpload } from "./provider";
import { pruneDownloads } from "./cache";
import {
  getQueue,
  getBlacklist,
  insertBlacklist,
  removeBlacklist,
  removeFromQueueBySourceId,
  getTracksBySourceIds,
} from "./db/queries";
import { join } from "path";
import { normalizeYouTubeUrl } from "./youtube";
import { ADMIN_PAGE_HTML } from "./admin-page";

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

    if (url.pathname === "/admin") {
      return new Response(ADMIN_PAGE_HTML, {
        headers: { "Content-Type": "text/html", ...corsHeaders },
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

    if (url.pathname === "/api/admin/blacklist" && req.method === "GET") {
      if (!isAdminAuthorized(req, url)) {
        return json({ error: "unauthorized" }, { status: 401 });
      }
      return json({ blacklist: getBlacklist(db) });
    }

    if (url.pathname === "/api/admin/cache" && req.method === "GET") {
      if (!isAdminAuthorized(req, url)) {
        return json({ error: "unauthorized" }, { status: 401 });
      }
      return handleCacheGet().catch((error) => {
        console.error("[api] /api/admin/cache error", error);
        return json({ error: error?.message ?? "internal error" }, { status: 500 });
      });
    }

    if (url.pathname === "/api/admin/blacklist" && req.method === "POST") {
      if (!isAdminAuthorized(req, url)) {
        return json({ error: "unauthorized" }, { status: 401 });
      }
      return handleBlacklistPost(req).catch((error) => {
        console.error("[api] /api/admin/blacklist error", error);
        return json({ error: error?.message ?? "internal error" }, { status: 500 });
      });
    }

    if (url.pathname.startsWith("/api/admin/blacklist/") && req.method === "DELETE") {
      if (!isAdminAuthorized(req, url)) {
        return json({ error: "unauthorized" }, { status: 401 });
      }
      const sourceId = url.pathname.split("/").pop();
      if (!sourceId) {
        return json({ error: "missing source id" }, { status: 400 });
      }
      removeBlacklist(db, "youtube", sourceId);
      return json({ ok: true });
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
    const message = error instanceof Error ? error.message : "request failed";
    return json({ error: message }, { status: 400 });
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

function isAdminAuthorized(req: Request, url: URL): boolean {
  if (!ADMIN_TOKEN) return false;
  const auth = req.headers.get("authorization") ?? "";
  if (auth.startsWith("Bearer ")) {
    return auth.slice(7) === ADMIN_TOKEN;
  }
  const token = url.searchParams.get("token");
  return token === ADMIN_TOKEN;
}

async function handleBlacklistPost(req: Request): Promise<Response> {
  let body: { url?: string; source_id?: string; reason?: string };
  try {
    body = (await req.json()) as { url?: string; source_id?: string; reason?: string };
  } catch {
    return json({ error: "invalid json" }, { status: 400 });
  }

  let sourceId = body.source_id?.trim();
  let sourceUrl = body.url?.trim() ?? null;

  if (sourceUrl) {
    const normalized = normalizeYouTubeUrl(sourceUrl);
    if (!normalized) return json({ error: "invalid youtube url" }, { status: 400 });
    sourceId = normalized.id;
    sourceUrl = normalized.url;
  }

  if (!sourceId) {
    return json({ error: "source_id or url required" }, { status: 400 });
  }

  if (!/^[a-zA-Z0-9_-]{11}$/.test(sourceId)) {
    return json({ error: "invalid source id" }, { status: 400 });
  }

  const entry = insertBlacklist(db, {
    source: "youtube",
    source_id: sourceId,
    source_url: sourceUrl,
    reason: body.reason?.trim() ?? null,
  });

  removeFromQueueBySourceId(db, "youtube", sourceId);
  refreshQueue(db);

  return json({ ok: true, entry });
}

async function handleCacheGet(): Promise<Response> {
  const entries: Array<{ source_id: string; mtime_ms: number; size_bytes: number }> = [];
  for await (const entry of new Bun.Glob(`${DOWNLOAD_DIR}/*.mp3`).scan()) {
    const filename = entry.split("/").pop();
    if (!filename) continue;
    const sourceId = filename.replace(/\.mp3$/, "");
    if (!/^[a-zA-Z0-9_-]{11}$/.test(sourceId)) continue;
    const stat = await Bun.file(entry).stat();
    entries.push({ source_id: sourceId, mtime_ms: stat.mtimeMs, size_bytes: stat.size });
  }

  const sourceIds = entries.map((entry) => entry.source_id);
  const tracks = getTracksBySourceIds(db, "youtube", sourceIds);
  const trackById = new Map<string, typeof tracks[number]>();
  for (const track of tracks) trackById.set(track.source_id, track);

  const blacklist = getBlacklist(db);
  const blacklistSet = new Set(blacklist.map((item) => item.source_id));

  const items = entries
    .map((entry) => {
      const track = trackById.get(entry.source_id);
      return {
        source_id: entry.source_id,
        source_url: track?.source_url ?? null,
        title: track?.title ?? "Unknown",
        uploader: track?.uploader ?? null,
        duration_sec: track?.duration_sec ?? null,
        mtime_ms: entry.mtime_ms,
        size_bytes: entry.size_bytes,
        blacklisted: blacklistSet.has(entry.source_id),
      };
    })
    .sort((a, b) => b.mtime_ms - a.mtime_ms);

  return json({ items });
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
