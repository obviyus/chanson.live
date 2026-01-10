import { Database } from "bun:sqlite";

/**
 * Initialize database with schema.
 * Uses bun:sqlite for zero-dependency SQLite.
 */
export function initDatabase(path: string): Database {
  const db = new Database(path, { create: true });

  // Enable WAL mode for better concurrent read performance
  db.exec("PRAGMA journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS tracks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT NOT NULL,
      source_id TEXT NOT NULL,
      source_url TEXT NOT NULL,
      title TEXT NOT NULL,
      uploader TEXT,
      duration_sec INTEGER,
      file_path TEXT,
      create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(source, source_id)
    );

    CREATE TABLE IF NOT EXISTS queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      track_id INTEGER NOT NULL REFERENCES tracks(id),
      position INTEGER NOT NULL,
      requested_by TEXT,
      create_time DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS play_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      track_id INTEGER NOT NULL REFERENCES tracks(id),
      requested_by TEXT,
      source TEXT NOT NULL,
      create_time DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_tracks_source_id ON tracks(source, source_id);
    CREATE INDEX IF NOT EXISTS idx_queue_position ON queue(position);
    CREATE INDEX IF NOT EXISTS idx_history_track_id ON play_history(track_id);
    CREATE INDEX IF NOT EXISTS idx_history_create_time ON play_history(create_time);
  `);

  return db;
}

export interface Track {
  id: number;
  source: string;
  source_id: string;
  source_url: string;
  title: string;
  uploader: string | null;
  duration_sec: number | null;
  file_path: string | null;
  create_time: string;
}

export interface QueueItem {
  id: number;
  track_id: number;
  position: number;
  requested_by: string | null;
  create_time: string;
}

export interface PlayHistory {
  id: number;
  track_id: number;
  requested_by: string | null;
  source: string;
  create_time: string;
}
