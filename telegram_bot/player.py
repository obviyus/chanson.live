import os
import subprocess
import threading
from functools import lru_cache
from pathlib import Path
from typing import Tuple

import requests
from spotdl import Song, Spotdl
from telegram import Message, ParseMode
from telegram.ext import CallbackContext

import config
from db import sqlite_conn

spotdl = Spotdl(
    headless=True,
    client_id=config.keys["SPOTIFY_CLIENT_ID"],
    client_secret=config.keys["SPOTIFY_CLIENT_SECRET"],
    no_cache=True,
    audio_providers=["youtube-music", "youtube"],
)


def backup_stream(context: CallbackContext):
    cursor = sqlite_conn.cursor()

    # Play a random song from the database
    cursor.execute(
        """
        SELECT * FROM song_stats ORDER BY RANDOM() LIMIT 1;
        """
    )

    song = None
    while not song:
        try:
            result = music_search(cursor.fetchone()["display_name"])

            if result:
                song, path = result

                context.bot_data["song_queue"] = [(song, path, None)]
        except Exception:
            pass


def queue_player(context: CallbackContext):
    if len(context.bot_data["song_queue"]) == 0:
        backup_stream(context)

    while len(context.bot_data["song_queue"]) > 0:
        print(context.bot_data["song_queue"][0])

        song, path, message = context.bot_data["song_queue"][0]
        song: Song

        if message:
            message.reply_text(
                f"Playing <b>{song.display_name}</b> by <b>{song.artist}</b>."
                f"<a href='{song.cover_url}'>&#8205;</a>",
                parse_mode=ParseMode.HTML,
            )

        context.bot_data["now_playing"] = song

        response = requests.post(
            "http://127.0.0.1:8081/startProducer",
            data={
                "title": song.name,
                "artist": song.artist,
                "album": song.album_name,
                "cover": song.cover_url,
            },
        ).json()

        p = subprocess.Popen(
            [
                "ffmpeg",
                "-re",
                "-v",
                "info",
                "-i",
                f"{path}",
                "-q:a",
                "0",
                "-map",
                "a",
                "-acodec",
                "libopus",
                "-ab",
                "128k",
                "-ac",
                "2",
                "-ar",
                "48000",
                "-f",
                "tee",
                f"[select=a:f=rtp:ssrc=11111111:payload_type=101]rtp://127.0.0.1:{response['rtpPort']}?rtcpport={response['rtcpPort']}",
            ]
        )

        context.bot_data["PID"] = p.pid

        p.wait()

    requests.get("http://127.0.0.1:8081/stopProducer")
    context.bot_data["now_playing"] = None
    context.bot_data["song_queue"].pop(0)

    # Backup to play downloaded songs if queue is empty
    if len(context.bot_data["song_queue"]) == 0:
        backup_stream(context)


@lru_cache(maxsize=None)
def music_search(query: str, message: Message = None) -> Tuple[Song, Path] | None:
    song_list = spotdl.search(
        [query],
    )

    if song_list:
        cursor = sqlite_conn.cursor()

        if message:
            message.reply_text(
                f"Adding <b>{song_list[0].display_name}</b> by <b>{song_list[0].artist}</b> to the queue."
                f"<a href='{song_list[0].cover_url}'>&#8205;</a>",
                parse_mode=ParseMode.HTML,
            )

        if Path(f"{song_list[0].song_id}.opus").exists():
            return song_list[0], Path(f"{song_list[0].song_id}.opus")

        song, path = spotdl.download(song_list[0])
        if not song.song_id:
            song.song_id = song_list[0].song_id

        try:
            os.rename(path, f"{song.song_id}.opus")
        except Exception:
            return

        if message:
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
                (song.song_id, song.display_name),
            )

        return song, Path(f"{song.song_id}.opus")


def playlist_search(query: str, context, message: Message = None):
    if message:
        message.reply_text(
            f"Searching for <b>{query}</b>. This might take a while.",
            parse_mode=ParseMode.HTML,
        )

    playlist = spotdl.search([query])

    if not playlist:
        message.reply_text(f"No results for *{query}*.")
        return

    if message:
        message.reply_text(
            f"Adding <b>{len(playlist)}</b> songs to the queue.",
            parse_mode=ParseMode.HTML,
        )

    song, path = spotdl.download(playlist[0])
    os.rename(path, f"{song.song_id}.opus")

    if not context.bot_data["song_queue"]:
        context.bot_data["song_queue"] = [(song, f"{song.song_id}.opus", message)]
    else:
        context.bot_data["song_queue"].append((song, f"{song.song_id}.opus", message))

    if not context.bot_data["now_playing"]:
        threading.Thread(target=queue_player, args=(context,)).start()

    for song in playlist[1:]:
        if Path(f"{song.song_id}.opus").exists():
            context.bot_data["song_queue"].append(
                (song, f"{song.song_id}.opus", message)
            )
            continue

        song, path = spotdl.download(song)
        if not song.song_id:
            song.song_id = song.song_id

        try:
            os.rename(path, f"{song.song_id}.opus")
        except TypeError:
            continue

        context.bot_data["song_queue"].append((song, f"{song.song_id}.opus", message))

        cursor = sqlite_conn.cursor()
        if message:
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
                (song.song_id, song.display_name),
            )
