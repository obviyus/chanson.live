import type { Database } from "bun:sqlite";
import type { Track, QueueItem, BlacklistedSource } from "./schema";

/**
 * AIDEV-NOTE: Queries use prepared statements via db.query() for safety and performance.
 */

export function getTrackBySourceId(
  db: Database,
  source: string,
  sourceId: string
): Track | null {
  return db
    .query<Track, [string, string]>(
      "SELECT * FROM tracks WHERE source = ? AND source_id = ?"
    )
    .get(source, sourceId);
}

export function getTracksBySourceIds(
  db: Database,
  source: string,
  sourceIds: string[]
): Track[] {
  if (sourceIds.length === 0) return [];
  const placeholders = sourceIds.map(() => "?").join(", ");
  return db
    .query<Track, [string, ...string[]]>(
      `SELECT * FROM tracks WHERE source = ? AND source_id IN (${placeholders})`
    )
    .all(source, ...sourceIds);
}

export function insertTrack(
  db: Database,
  track: Omit<Track, "id" | "create_time">
): Track {
  const stmt = db.query<
    Track,
    [string, string, string, string, string | null, number | null, string | null]
  >(`
    INSERT INTO tracks (source, source_id, source_url, title, uploader, duration_sec, file_path)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    RETURNING *
  `);

  return stmt.get(
    track.source,
    track.source_id,
    track.source_url,
    track.title,
    track.uploader,
    track.duration_sec,
    track.file_path
  )!;
}

export function updateTrackFilePath(
  db: Database,
  trackId: number,
  filePath: string
): void {
  db.query("UPDATE tracks SET file_path = ? WHERE id = ?").run(filePath, trackId);
}

export function updateTrackFilePathBySourceId(
  db: Database,
  source: string,
  sourceId: string,
  filePath: string | null
): void {
  db.query(
    "UPDATE tracks SET file_path = ? WHERE source = ? AND source_id = ?"
  ).run(filePath, source, sourceId);
}

export function updateTrackMetadataBySourceId(
  db: Database,
  source: string,
  sourceId: string,
  data: {
    title: string;
    uploader: string | null;
    duration_sec: number | null;
    source_url: string;
  }
): void {
  db.query(
    `
    UPDATE tracks
    SET title = ?, uploader = ?, duration_sec = ?, source_url = ?
    WHERE source = ? AND source_id = ?
  `
  ).run(
    data.title,
    data.uploader,
    data.duration_sec,
    data.source_url,
    source,
    sourceId
  );
}

export function getQueue(db: Database): (QueueItem & Track)[] {
  return db
    .query<QueueItem & Track, []>(`
      SELECT q.*, t.source, t.source_id, t.source_url, t.title, t.uploader, t.duration_sec, t.file_path
      FROM queue q
      JOIN tracks t ON q.track_id = t.id
      ORDER BY q.position ASC
    `)
    .all();
}

export function addToQueue(
  db: Database,
  trackId: number,
  requestedBy: string | null
): QueueItem {
  const maxPos = db
    .query<{ max_pos: number | null }, []>(
      "SELECT MAX(position) as max_pos FROM queue"
    )
    .get();
  const position = (maxPos?.max_pos ?? -1) + 1;

  const stmt = db.query<QueueItem, [number, number, string | null]>(`
    INSERT INTO queue (track_id, position, requested_by)
    VALUES (?, ?, ?)
    RETURNING *
  `);
  return stmt.get(trackId, position, requestedBy)!;
}

export function removeFromQueue(db: Database, queueId: number): void {
  const item = db
    .query<QueueItem, [number]>("SELECT position FROM queue WHERE id = ?")
    .get(queueId);
  if (!item) return;

  db.query("DELETE FROM queue WHERE id = ?").run(queueId);
  db.query("UPDATE queue SET position = position - 1 WHERE position > ?").run(item.position);
}

export function popQueue(db: Database): (QueueItem & Track) | null {
  const first = db
    .query<QueueItem & Track, []>(`
      SELECT q.*, t.source, t.source_id, t.source_url, t.title, t.uploader, t.duration_sec, t.file_path
      FROM queue q
      JOIN tracks t ON q.track_id = t.id
      ORDER BY q.position ASC
      LIMIT 1
    `)
    .get();

  if (first) removeFromQueue(db, first.id);
  return first ?? null;
}

export function peekQueue(db: Database): (QueueItem & Track) | null {
  return db
    .query<QueueItem & Track, []>(`
      SELECT q.*, t.source, t.source_id, t.source_url, t.title, t.uploader, t.duration_sec, t.file_path
      FROM queue q
      JOIN tracks t ON q.track_id = t.id
      ORDER BY q.position ASC
      LIMIT 1
    `)
    .get();
}

export function removeFromQueueByTrackId(db: Database, trackId: number): void {
  const item = db
    .query<{ id: number; position: number }, [number]>(
      "SELECT id, position FROM queue WHERE track_id = ?"
    )
    .get(trackId);
  if (!item) return;

  db.query("DELETE FROM queue WHERE id = ?").run(item.id);
  db.query("UPDATE queue SET position = position - 1 WHERE position > ?").run(item.position);
}

export function clearQueue(db: Database): void {
  db.query("DELETE FROM queue").run();
}

export function addToHistory(
  db: Database,
  trackId: number,
  requestedBy: string | null,
  source: string
): void {
  db.query(
    `
    INSERT INTO play_history (track_id, requested_by, source)
    VALUES (?, ?, ?)
  `
  ).run(trackId, requestedBy, source);
}

export function getBlacklist(db: Database): BlacklistedSource[] {
  return db
    .query<BlacklistedSource, []>(
      "SELECT * FROM blacklist ORDER BY create_time DESC"
    )
    .all();
}

export function isBlacklisted(
  db: Database,
  source: string,
  sourceId: string
): boolean {
  const row = db
    .query<{ count: number }, [string, string]>(
      "SELECT COUNT(*) as count FROM blacklist WHERE source = ? AND source_id = ?"
    )
    .get(source, sourceId);
  return (row?.count ?? 0) > 0;
}

export function insertBlacklist(
  db: Database,
  data: {
    source: string;
    source_id: string;
    source_url: string | null;
    reason: string | null;
  }
): BlacklistedSource {
  return db
    .query<
      BlacklistedSource,
      [string, string, string | null, string | null]
    >(
      `
    INSERT INTO blacklist (source, source_id, source_url, reason)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(source, source_id)
    DO UPDATE SET source_url = excluded.source_url, reason = excluded.reason
    RETURNING *
  `
    )
    .get(data.source, data.source_id, data.source_url, data.reason)!;
}

export function removeBlacklist(
  db: Database,
  source: string,
  sourceId: string
): void {
  db.query("DELETE FROM blacklist WHERE source = ? AND source_id = ?").run(
    source,
    sourceId
  );
}

export function removeFromQueueBySourceId(
  db: Database,
  source: string,
  sourceId: string
): void {
  db.query(
    `
    DELETE FROM queue
    WHERE track_id IN (
      SELECT id FROM tracks WHERE source = ? AND source_id = ?
    )
  `
  ).run(source, sourceId);
}
