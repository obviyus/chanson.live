import type { Database } from "bun:sqlite";
import type { Track } from "./db/schema";
import {
  getTrackBySourceId,
  insertTrack,
  updateTrackFilePath,
} from "./db/queries";
import {
  normalizeYouTubeUrl,
  fetchYouTubeInfo,
  downloadYouTubeAudio,
} from "./youtube";

export async function ensureLocalTrackFromYouTubeUrl(
  db: Database,
  inputUrl: string
): Promise<Track> {
  const normalized = normalizeYouTubeUrl(inputUrl);
  if (!normalized) {
    throw new Error("Invalid YouTube URL");
  }

  const existing = getTrackBySourceId(db, "youtube", normalized.id);
  if (existing) {
    if (existing.file_path && (await Bun.file(existing.file_path).exists())) {
      return existing;
    }

    const filePath = await downloadYouTubeAudio(normalized.url, normalized.id);
    updateTrackFilePath(db, existing.id, filePath);
    return { ...existing, file_path: filePath };
  }

  const info = await fetchYouTubeInfo(normalized.url);
  const filePath = await downloadYouTubeAudio(normalized.url, info.id);

  return insertTrack(db, {
    source: "youtube",
    source_id: info.id,
    source_url: info.url,
    title: info.title,
    uploader: info.uploader,
    duration_sec: info.duration_sec,
    file_path: filePath,
  });
}
