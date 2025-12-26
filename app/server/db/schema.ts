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
    -- Song metadata cache
    CREATE TABLE IF NOT EXISTS songs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      spotify_id TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      artist TEXT NOT NULL,
      album TEXT NOT NULL,
      cover_url TEXT NOT NULL,
      duration_ms INTEGER,
      file_path TEXT,
      create_time DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Play history for analytics and auto-queue
    CREATE TABLE IF NOT EXISTS play_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      song_id INTEGER NOT NULL REFERENCES songs(id),
      requested_by TEXT,
      played_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      source TEXT DEFAULT 'manual'
    );

    -- Aggregated song statistics
    CREATE TABLE IF NOT EXISTS song_stats (
      song_id INTEGER PRIMARY KEY REFERENCES songs(id),
      play_count INTEGER DEFAULT 0,
      last_played DATETIME
    );

    -- Blacklisted songs
    CREATE TABLE IF NOT EXISTS blacklist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      spotify_id TEXT UNIQUE NOT NULL,
      reason TEXT,
      create_time DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Current queue (persisted for crash recovery)
    CREATE TABLE IF NOT EXISTS queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      song_id INTEGER NOT NULL REFERENCES songs(id),
      position INTEGER NOT NULL,
      requested_by TEXT,
      is_automated BOOLEAN DEFAULT FALSE,
      create_time DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Indexes for common queries
    CREATE INDEX IF NOT EXISTS idx_songs_spotify_id ON songs(spotify_id);
    CREATE INDEX IF NOT EXISTS idx_play_history_song_id ON play_history(song_id);
    CREATE INDEX IF NOT EXISTS idx_play_history_played_at ON play_history(played_at);
    CREATE INDEX IF NOT EXISTS idx_queue_position ON queue(position);
  `);

  return db;
}

// Type definitions for database rows
export interface Song {
  id: number;
  spotify_id: string;
  title: string;
  artist: string;
  album: string;
  cover_url: string;
  duration_ms: number | null;
  file_path: string | null;
  create_time: string;
}

export interface PlayHistory {
  id: number;
  song_id: number;
  requested_by: string | null;
  played_at: string;
  source: string;
}

export interface SongStats {
  song_id: number;
  play_count: number;
  last_played: string | null;
}

export interface QueueItem {
  id: number;
  song_id: number;
  position: number;
  requested_by: string | null;
  is_automated: boolean;
  create_time: string;
}
