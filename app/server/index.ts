import { initDatabase } from "./db/schema";
import { ensureDirectories } from "./fs";
import { DB_PATH, PORT, STUN_URLS } from "./config";
import { websocketHandler, upgradeToWebSocket } from "./websocket";
import { initQueue, getQueueSnapshot, enqueueTrack } from "./queue";
import { ensureTrackFromYouTubeUrl } from "./tracks";
import { Player } from "./player";
import { TEST_PAGE_HTML } from "./test-page";
import { APP_PAGE_HTML } from "./app-page";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
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
      const response = upgradeToWebSocket(req, server);
      if (response) return response;
      return undefined;
    }

    if (url.pathname === "/health") {
      return new Response("ok", { headers: corsHeaders });
    }

    if (url.pathname === "/api/config") {
      return json({
        ice_servers: buildIceServers(),
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

  const track = await ensureTrackFromYouTubeUrl(db, body.url);
  enqueueTrack(db, track, body.requested_by ?? null);

  return json({ ok: true, track });
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
