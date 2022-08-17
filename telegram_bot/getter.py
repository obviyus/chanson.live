import os
from pathlib import Path

from spotdl import Song, Spotdl
from telegram import Message, ParseMode

import config
from db import sqlite_conn

spotdl = Spotdl(
    headless=True,
    client_id=config.keys["SPOTIFY_CLIENT_ID"],
    client_secret=config.keys["SPOTIFY_CLIENT_SECRET"],
    no_cache=True,
    audio_providers=['youtube-music']
)


def music_search(query: str, message: Message = None) -> (Song, Path) or None:
    song_list = spotdl.search(
        [query],
    )

    if song_list:
        cursor = sqlite_conn.cursor()
        message.reply_text(
            f"Adding <b>{song_list[0].display_name}</b> by <b>{song_list[0].artist}</b> to the queue."
            f"<a href='{song_list[0].cover_url}'>&#8205;</a>",
            parse_mode=ParseMode.HTML,
        )

        if Path(f"{song_list[0].song_id}.opus").exists():
            return song_list[0], f"{song_list[0].song_id}.opus"

        song, path = spotdl.download(song_list[0])

        os.rename(path, f"{song.song_id}.opus")

        if song.duration > 600:
            return None

        cursor.execute(
            """
            INSERT INTO song_log (song_id, display_name, user_id)
            VALUES (?, ?, ?)
            """,
            (song.song_id, song.display_name, message.from_user.id),
        )

        cursor.execute(
            """
            INSERT INTO song_stats (song_id, display_name) VALUES (?, ?)
            ON CONFLICT (song_id) DO UPDATE SET play_count = play_count + 1;
            """,
            (song.song_id, song.display_name)
        )

        return song, f"{song.song_id}.opus"
