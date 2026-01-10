import { join } from "path";
import { DOWNLOAD_DIR } from "./config";

export interface YouTubeInfo {
  id: string;
  url: string;
  title: string;
  uploader: string | null;
  duration_sec: number | null;
}

/**
 * AIDEV-NOTE: URL parsing + yt-dlp invocation is a critical path; keep strict validation
 * and surface stderr on failure for easier debugging.
 */
export function normalizeYouTubeUrl(input: string): { id: string; url: string } | null {
  const trimmed = input.trim();

  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return { id: trimmed, url: `https://www.youtube.com/watch?v=${trimmed}` };
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "");
  let id: string | null = null;

  if (host === "youtu.be") {
    id = url.pathname.slice(1).split("/")[0] || null;
  } else if (host.endsWith("youtube.com")) {
    if (url.pathname === "/watch") {
      id = url.searchParams.get("v");
    } else if (url.pathname.startsWith("/shorts/")) {
      id = url.pathname.split("/")[2] || null;
    } else if (url.pathname.startsWith("/embed/")) {
      id = url.pathname.split("/")[2] || null;
    }
  }

  if (!id || !/^[a-zA-Z0-9_-]{11}$/.test(id)) return null;
  return { id, url: `https://www.youtube.com/watch?v=${id}` };
}

export async function fetchYouTubeInfo(url: string): Promise<YouTubeInfo> {
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
    id: string;
    title: string;
    uploader?: string;
    channel?: string;
    duration?: number;
    webpage_url?: string;
  };

  return {
    id: info.id,
    url: info.webpage_url ?? url,
    title: info.title,
    uploader: info.uploader ?? info.channel ?? null,
    duration_sec: typeof info.duration === "number" ? info.duration : null,
  };
}

export async function downloadYouTubeAudio(
  url: string,
  id: string
): Promise<string> {
  const outputTemplate = join(DOWNLOAD_DIR, `${id}.%(ext)s`);

  const proc = Bun.spawn([
    "yt-dlp",
    "-x",
    "--audio-format",
    "opus",
    "--audio-quality",
    "0",
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

  const expectedPath = join(DOWNLOAD_DIR, `${id}.opus`);
  if (!(await Bun.file(expectedPath).exists())) {
    throw new Error("yt-dlp finished but output file missing");
  }

  return expectedPath;
}
