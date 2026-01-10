import type { Database } from "bun:sqlite";
import type { QueueItem, Track } from "./db/schema";
import type { TrackMetadata } from "./types";
import { addToQueue, getQueue, popQueue } from "./db/queries";
import { broadcastQueue } from "./websocket";

let queueSnapshot: TrackMetadata[] = [];

function toTrackMetadata(row: QueueItem & Track): TrackMetadata {
  return {
    id: row.track_id,
    source: row.source,
    source_id: row.source_id,
    source_url: row.source_url,
    title: row.title,
    uploader: row.uploader,
    duration_sec: row.duration_sec,
    file_path: row.file_path,
    requested_by: row.requested_by ?? null,
  };
}

export function initQueue(db: Database): void {
  queueSnapshot = getQueue(db).map((row) => toTrackMetadata(row));
  broadcastQueue(queueSnapshot);
}

export function getQueueSnapshot(): TrackMetadata[] {
  return queueSnapshot;
}

export function enqueueTrack(
  db: Database,
  track: Track,
  requestedBy: string | null
): void {
  addToQueue(db, track.id, requestedBy);
  queueSnapshot = getQueue(db).map((row) => toTrackMetadata(row));
  broadcastQueue(queueSnapshot);
}

export function popNextTrack(db: Database): TrackMetadata | null {
  const next = popQueue(db);
  queueSnapshot = getQueue(db).map((row) => toTrackMetadata(row));
  broadcastQueue(queueSnapshot);
  return next ? toTrackMetadata(next) : null;
}
