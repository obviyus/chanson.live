import type { Database } from "bun:sqlite";
import type { Song, QueueItem } from "./schema";

/**
 * AIDEV-NOTE: All queries use prepared statements via db.query() for safety and performance.
 * bun:sqlite automatically handles parameter binding.
 */

// Song queries
export function getSongBySpotifyId(db: Database, spotifyId: string): Song | null {
  return db.query<Song, [string]>("SELECT * FROM songs WHERE spotify_id = ?").get(spotifyId);
}

export function insertSong(
  db: Database,
  song: Omit<Song, "id" | "create_time">
): Song {
  const stmt = db.query<Song, [string, string, string, string, string, number | null, string | null]>(`
    INSERT INTO songs (spotify_id, title, artist, album, cover_url, duration_ms, file_path)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    RETURNING *
  `);
  return stmt.get(
    song.spotify_id,
    song.title,
    song.artist,
    song.album,
    song.cover_url,
    song.duration_ms,
    song.file_path
  )!;
}

export function updateSongFilePath(db: Database, spotifyId: string, filePath: string): void {
  db.query("UPDATE songs SET file_path = ? WHERE spotify_id = ?").run(filePath, spotifyId);
}

// Queue queries
export function getQueue(db: Database): (QueueItem & Song)[] {
  return db.query<QueueItem & Song, []>(`
    SELECT q.*, s.spotify_id, s.title, s.artist, s.album, s.cover_url, s.duration_ms, s.file_path
    FROM queue q
    JOIN songs s ON q.song_id = s.id
    ORDER BY q.position ASC
  `).all();
}

export function addToQueue(
  db: Database,
  songId: number,
  requestedBy: string | null,
  isAutomated: boolean
): QueueItem {
  // Get max position
  const maxPos = db.query<{ max_pos: number | null }, []>(
    "SELECT MAX(position) as max_pos FROM queue"
  ).get();
  const position = (maxPos?.max_pos ?? -1) + 1;

  const stmt = db.query<QueueItem, [number, number, string | null, boolean]>(`
    INSERT INTO queue (song_id, position, requested_by, is_automated)
    VALUES (?, ?, ?, ?)
    RETURNING *
  `);
  return stmt.get(songId, position, requestedBy, isAutomated)!;
}

export function removeFromQueue(db: Database, queueId: number): void {
  const item = db.query<QueueItem, [number]>("SELECT position FROM queue WHERE id = ?").get(queueId);
  if (!item) return;

  db.query("DELETE FROM queue WHERE id = ?").run(queueId);
  // Reorder remaining items
  db.query("UPDATE queue SET position = position - 1 WHERE position > ?").run(item.position);
}

export function popQueue(db: Database): (QueueItem & Song) | null {
  const first = db.query<QueueItem & Song, []>(`
    SELECT q.*, s.spotify_id, s.title, s.artist, s.album, s.cover_url, s.duration_ms, s.file_path
    FROM queue q
    JOIN songs s ON q.song_id = s.id
    ORDER BY q.position ASC
    LIMIT 1
  `).get();

  if (first) {
    removeFromQueue(db, first.id);
  }

  return first ?? null;
}

export function clearQueue(db: Database): void {
  db.query("DELETE FROM queue").run();
}

// History queries
export function addToHistory(
  db: Database,
  songId: number,
  requestedBy: string | null,
  source: string
): void {
  db.query(`
    INSERT INTO play_history (song_id, requested_by, source)
    VALUES (?, ?, ?)
  `).run(songId, requestedBy, source);

  // Update stats
  db.query(`
    INSERT INTO song_stats (song_id, play_count, last_played)
    VALUES (?, 1, CURRENT_TIMESTAMP)
    ON CONFLICT(song_id) DO UPDATE SET
      play_count = play_count + 1,
      last_played = CURRENT_TIMESTAMP
  `).run(songId);
}

/**
 * Get songs for auto-queue: songs not played in last 100 plays, ordered randomly.
 */
export function getSongsForAutoQueue(db: Database, limit: number): Song[] {
  return db.query<Song, [number]>(`
    SELECT s.* FROM songs s
    WHERE s.file_path IS NOT NULL
      AND s.id NOT IN (
        SELECT song_id FROM play_history
        ORDER BY id DESC
        LIMIT 100
      )
      AND s.spotify_id NOT IN (SELECT spotify_id FROM blacklist)
    ORDER BY RANDOM()
    LIMIT ?
  `).all(limit);
}

// Blacklist queries
export function isBlacklisted(db: Database, spotifyId: string): boolean {
  const result = db.query<{ count: number }, [string]>(
    "SELECT COUNT(*) as count FROM blacklist WHERE spotify_id = ?"
  ).get(spotifyId);
  return (result?.count ?? 0) > 0;
}

export function addToBlacklist(db: Database, spotifyId: string, reason: string | null): void {
  db.query(`
    INSERT OR IGNORE INTO blacklist (spotify_id, reason)
    VALUES (?, ?)
  `).run(spotifyId, reason);
}
