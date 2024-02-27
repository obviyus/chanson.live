import os
import signal

import requests
from telegram import Update
from telegram.constants import ParseMode
from telegram.ext import ContextTypes

from config.db import sqlite_conn


async def get_queue(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """
    Get the current queue up to
    """

    text = "<b>🎛️ Queue</b>\n\n"
    for index, song in enumerate(context.bot_data["queue"][:10]):
        text += f"{index + 1}. <b>{song['metadata']['title']}</b>\n"

    await update.message.reply_text(text, parse_mode=ParseMode.HTML)


async def now_playing(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """
    Get the currently playing song.
    """

    if len(context.bot_data["queue"]) == 0:
        await update.message.reply_text("Nothing is playing right now.")
        return

    song = context.bot_data["queue"][0]

    await update.message.reply_text(
        f"📀 Playing <b>{song['metadata']['title']}</b> by <b>{song['metadata']['artist']}</b>."
        f"<a href='{song['metadata']['cover_url']}'>&#8205;</a>",
        parse_mode=ParseMode.HTML,
    )


async def skip(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """
    Skip the current song.
    """

    pid = context.bot_data["PID"]
    os.kill(pid, signal.SIGINT)

    await update.message.reply_text("Skipped the current song.")


async def queue_builder(context: ContextTypes.DEFAULT_TYPE) -> None:
    """
    Check if there's at least 10 songs in the queue. If not, pick random songs from SQLite.
    """

    if len(context.bot_data["queue"]) < 10:
        cursor = sqlite_conn.cursor()
        cursor.execute(
            """
            SELECT *
            FROM song_log
            WHERE song_id NOT IN
                  (SELECT song_id FROM song_history ORDER BY song_history.id DESC LIMIT 100)
            ORDER BY RANDOM()
            LIMIT 10;
            """
        )

        for song in cursor.fetchall():
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

    await update_queue(context)


async def update_queue(context: ContextTypes.DEFAULT_TYPE) -> None:
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

    requests.post("http://127.0.0.1:8082/updateQueue", json=parsed_queue)


async def add_song_to_history(song_id: str) -> None:
    """
    Add a song to the history.
    """

    cursor = sqlite_conn.cursor()
    cursor.execute(
        """
        INSERT INTO song_history (song_id) VALUES (?);
        """,
        (song_id,),
    )
