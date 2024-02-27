import sqlite3

from config import config

sqlite_conn = sqlite3.connect(
    config["TELEGRAM"]["DATABASE_PATH"], check_same_thread=False, isolation_level=None
)

sqlite_conn.row_factory = sqlite3.Row

cursor = sqlite_conn.cursor()

# Table for YouTube ID vs. Title
cursor.execute(
    """
    CREATE TABLE IF NOT EXISTS song_log
    (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        song_id     TEXT,
        title       TEXT    NOT NULL,
        artist      TEXT    NOT NULL,
        album       TEXT    NOT NULL,
        cover_url   TEXT    NOT NULL,
        user_id     INTEGER NOT NULL,
        create_time DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    """
)

# Table for the current queue of songs
cursor.execute(
    """
    CREATE TABLE IF NOT EXISTS song_stats
    (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        song_id     TEXT UNIQUE,
        play_count  INTEGER NOT NULL DEFAULT 0,
        create_time DATETIME         DEFAULT CURRENT_TIMESTAMP
    );
    """
)

# Table for blacklisted songs
cursor.execute(
    """
    CREATE TABLE IF NOT EXISTS song_blacklist
    (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        song_id     TEXT UNIQUE,
        create_time DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    """
)

# Table for history of songs played
cursor.execute(
    """
    CREATE TABLE IF NOT EXISTS song_history
    (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        song_id     TEXT,
        create_time DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    """
)

cursor.close()
