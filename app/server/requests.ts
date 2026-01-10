import { join } from "path";
import type { Database } from "bun:sqlite";
import { DOWNLOAD_DIR, PROVIDER_MODE } from "./config";
import { enqueueTrack } from "./queue";
import {
  getTrackBySourceId,
  insertTrack,
  updateTrackFilePathBySourceId,
} from "./db/queries";
import { normalizeYouTubeUrl } from "./youtube";
import { ensureLocalTrackFromYouTubeUrl } from "./tracks";
import { canUseExternalProvider, requestTrackFromProvider } from "./provider";

const PLACEHOLDER_TITLE = "Pending download";

export async function handleQueueRequest(
  db: Database,
  inputUrl: string,
  requestedBy: string | null
) {
  if (PROVIDER_MODE !== "external") {
    const track = await ensureLocalTrackFromYouTubeUrl(db, inputUrl);
    enqueueTrack(db, track, requestedBy);
    return track;
  }

  const normalized = normalizeYouTubeUrl(inputUrl);
  if (!normalized) {
    throw new Error("Invalid YouTube URL");
  }

  const sourceId = normalized.id;
  const filePath = join(DOWNLOAD_DIR, `${sourceId}.mp3`);
  const fileExists = await Bun.file(filePath).exists();

  let track = getTrackBySourceId(db, "youtube", sourceId);
  if (fileExists) {
    if (!track) {
      track = insertTrack(db, {
        source: "youtube",
        source_id: sourceId,
        source_url: normalized.url,
        title: PLACEHOLDER_TITLE,
        uploader: null,
        duration_sec: null,
        file_path: filePath,
      });
    } else if (!track.file_path) {
      updateTrackFilePathBySourceId(db, "youtube", sourceId, filePath);
      track = { ...track, file_path: filePath };
    }

    enqueueTrack(db, track, requestedBy);
    return track;
  }

  if (!canUseExternalProvider()) {
    throw new Error("Audio provider offline");
  }

  if (!track) {
    track = insertTrack(db, {
      source: "youtube",
      source_id: sourceId,
      source_url: normalized.url,
      title: PLACEHOLDER_TITLE,
      uploader: null,
      duration_sec: null,
      file_path: null,
    });
  }

  const requested = requestTrackFromProvider(sourceId, normalized.url);
  if (!requested) {
    throw new Error("Failed to request track from provider");
  }

  enqueueTrack(db, track, requestedBy);
  return track;
}
