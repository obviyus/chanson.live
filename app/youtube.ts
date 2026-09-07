import { join } from "path";

export interface YouTubeInfo {
  id: string;
  url: string;
  title: string;
  uploader: string | null;
  duration_sec: number | null;
}

function isLiveVideo(info: {
  live_status?: string;
  is_live?: boolean;
  was_live?: boolean;
}): boolean {
  return info.live_status !== undefined
    ? info.live_status !== "not_live"
    : info.is_live === true || info.was_live === true;
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
    live_status?: string;
    is_live?: boolean;
    was_live?: boolean;
  };

  if (isLiveVideo(info)) {
    throw new Error("Live videos are not supported");
  }

  return {
    id: info.id,
    url: info.webpage_url ?? url,
    title: info.title,
    uploader: info.uploader ?? info.channel ?? null,
    duration_sec: typeof info.duration === "number" ? info.duration : null,
  };
}

export interface DownloadOptions {
  directory: string;
  quality: string;
  retry?: { attempts: number; fragments: number; sleep: string };
}

export async function downloadYouTubeAudio(
  url: string,
  id: string,
  options: DownloadOptions
): Promise<string> {
  const outputTemplate = join(options.directory, `${id}.%(ext)s`);
  const expectedPath = join(options.directory, `${id}.mp3`);
  // AIDEV-NOTE: Delegate retries to yt-dlp; keep only basic output validation here.
  const proc = Bun.spawn([
    "yt-dlp",
    "-x",
    "--audio-format",
    "mp3",
    "--audio-quality",
    options.quality,
    ...(options.retry ? [
      "--retries", String(options.retry.attempts),
      "--fragment-retries", String(options.retry.fragments),
      "--retry-sleep", options.retry.sleep,
    ] : []),
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

  const file = Bun.file(expectedPath);
  if (!(await file.exists())) {
    throw new Error("yt-dlp finished but output file missing");
  }
  if (file.size === 0) {
    await file.delete();
    throw new Error("yt-dlp finished but output file was empty");
  }

  return expectedPath;
}
