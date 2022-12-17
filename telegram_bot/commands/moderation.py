import os
import signal

from telegram import Update
from telegram.ext import CallbackContext

from config import config
from config.db import sqlite_conn


def blacklist(update: Update, context: CallbackContext) -> None:
    """
    Blacklist the current song in the database.
    """

    if update.effective_user.id not in config["TELEGRAM"]["ADMINS"]:
        update.message.reply_text("Only the admins can use this command.")
        return

    song = context.bot_data["queue"][0]
    song_id = song["metadata"]["song_id"]

    cursor = sqlite_conn.cursor()
    cursor.execute(
        """
        INSERT INTO song_blacklist (song_id) VALUES (?);
        """,
        (song_id,),
    )

    cursor.execute(
        """
        DELETE FROM song_log WHERE song_id = ?;
        """,
        (song_id,),
    )

    update.message.reply_text(f"Blacklisted <b>{song['metadata']['title']}</b>.")

    pid = context.bot_data["PID"]
    os.kill(pid, signal.SIGINT)
