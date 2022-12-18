import os
import signal

import requests
from telegram import ParseMode, Update
from telegram.ext import CallbackContext

from config.db import sqlite_conn


def get_queue(update: Update, context: CallbackContext) -> None:
    """
    Get the current queue up to
    """

    text = "<b>🎛️ Queue</b>\n\n"
    for index, song in enumerate(context.bot_data["queue"][:10]):
        text += f"{index + 1}. <b>{song['metadata']['title']}</b>\n"

    update.message.reply_text(text, parse_mode=ParseMode.HTML)


def now_playing(update: Update, context: CallbackContext) -> None:
    """
    Get the currently playing song.
    """

    song = context.bot_data["queue"][0]

    update.message.reply_text(
        f"📀 Playing <b>{song['metadata']['title']}</b> by <b>{song['metadata']['artist']}</b>."
        f"<a href='{song['metadata']['cover_url']}'>&#8205;</a>",
        parse_mode=ParseMode.HTML,
    )


def skip(update: Update, context: CallbackContext) -> None:
    """
    Skip the current song.
    """

    pid = context.bot_data["PID"]
    os.kill(pid, signal.SIGINT)

    update.message.reply_text("Skipped the current song.")


def queue_builder(context: CallbackContext) -> None:
    """
    Check if there's at least 10 songs in the queue. If not, pick random songs from SQLite.
    """

    if len(context.bot_data["queue"]) < 10:
        cursor = sqlite_conn.cursor()
        cursor.execute(
            """
            SELECT * FROM song_log ORDER BY RANDOM() LIMIT 10;
            """
        )

        for song in cursor.fetchall():
            if song["song_id"] in [s["song_id"] for s in context.bot_data["queue"]]:
                continue

            context.bot_data["queue"].append(
                {
                    "metadata": {
                        "title": song["title"],
                        "artist": song["artist"],
                        "album": song["album"],
                        "cover_url": song["cover_url"],
                    },
                    "song_id": song["song_id"],
                    "automated": True,
                    "message": None,
                }
            )

    update_queue(context)


def update_queue(context: CallbackContext) -> None:
    """
    Update the queue on the webserver.
    """

    parsed_queue = []
    for song in context.bot_data["queue"]:
        parsed_queue.append(
            {
                "title": song["metadata"]["title"],
                "artist": song["metadata"]["artist"],
                "album": song["metadata"]["album"],
                "cover": song["metadata"]["cover_url"],
            }
        )

    requests.post("http://127.0.0.1:8081/updateQueue", json=parsed_queue)
