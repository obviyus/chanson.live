#!/usr/bin/env bun
import { PORT } from "./config";
import { normalizeYouTubeUrl } from "./youtube";

/**
 * AIDEV-NOTE: This script imports index.ts, which starts the server as a side-effect.
 * Keep index.ts startup fast and deterministic for reliable tests.
 */

const inputUrl = Bun.argv[2] ?? Bun.env.TEST_YT_URL;
if (!inputUrl) {
  console.error("usage: bun run test:e2e <youtube-url>");
  process.exit(1);
}

const normalized = normalizeYouTubeUrl(inputUrl);
if (!normalized) {
  console.error("invalid youtube url");
  process.exit(1);
}

await import("./index");

const baseUrl = `http://localhost:${PORT}`;

await waitForHealth(baseUrl);

const enqueue = await fetch(`${baseUrl}/api/queue`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ url: normalized.url, requested_by: "test" }),
});

if (!enqueue.ok) {
  const text = await enqueue.text();
  console.error("queue failed:", text);
  process.exit(1);
}

const payload = await enqueue.json();
console.log("queued:", payload.track?.title ?? "ok");
console.log(`open ${baseUrl}/test`);

async function waitForHealth(baseUrl: string): Promise<void> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${baseUrl}/health`);
      if (res.ok) return;
    } catch {
      // wait
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  console.error("server not healthy on /health");
  process.exit(1);
}
