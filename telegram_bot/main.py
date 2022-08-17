import os
import signal
import subprocess

import requests
import spotdl
from telegram import Message, ParseMode, Update
from telegram.ext import CommandHandler, ContextTypes, Updater

import config
from db import sqlite_conn
from getter import music_search


def start(update: Update, _: ContextTypes):
    """
    Start command handler.
    """
    update.message.reply_text(f"👋 @{update.effective_user.username}")


def main():
    updater = Updater(
        token=config.keys["TELEGRAM_TOKEN"]
    )

    dispatcher = updater.dispatcher
    dispatcher.add_handler(CommandHandler('play', play, run_async=True))
    dispatcher.add_handler(CommandHandler('skip', skip, run_async=True))
    dispatcher.add_handler(CommandHandler('status', status, run_async=True))
    dispatcher.add_handler(CommandHandler('q', queue, run_async=True))
    dispatcher.add_handler(CommandHandler('clear', clear, run_async=True))

    dispatcher.bot_data['now_playing'] = ''
    dispatcher.bot_data['song_queue'] = []
    dispatcher.bot_data['PID'] = None

    updater.start_polling(drop_pending_updates=True)

    print("Started bot")

    updater.idle()


def clear(update, context):
    context.bot_data["song_queue"] = context.bot_data["song_queue"][:1]
    update.message.reply_text("Queue cleared.")


def queue_player(context: ContextTypes):
    while len(context.bot_data["song_queue"]) > 0:
        print(context.bot_data["song_queue"][0])
        song, path, message = context.bot_data["song_queue"][0]
        song: spotdl.Song

        if message:
            message.reply_text(
                f"Playing <b>{song.display_name}</b> by <b>{song.artist}</b>."
                f"<a href='{song.cover_url}'>&#8205;</a>",
                parse_mode=ParseMode.HTML,
            )

        context.bot_data["now_playing"] = song.display_name

        response = requests.get("http://127.0.0.1:8081/startProducer").json()
        p = subprocess.Popen(
            [
                "ffmpeg",
                "-re",
                "-v",
                "info",
                "-i",
                f"{path}",
                "-map",
                "0:a:0",
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
            cursor = sqlite_conn.cursor()
            cursor.execute(
                """
                SELECT * FROM song_stats ORDER BY RANDOM() LIMIT 1;
                """
            )

            song, path = music_search(cursor.fetchone()['display_name'])
            context.bot_data["song_queue"] = [
                (song, path, None)
            ]


def skip(update, context):
    pid = context.bot_data["PID"]

    if pid:
        os.kill(pid, signal.SIGINT)
        context.bot_data["PID"] = None

        update.message.reply_text("Skipped.")
    else:
        update.message.reply_text("No more songs in queue.")


def play(update, context):
    message = update.message
    query = " ".join(context.args)

    if not query:
        message.reply_text(
            "*Usage:* `/play {SONG_NAME}`\n" "*Example:* `/play Silvertown Blues`"
        )
    else:
        result = music_search(query, update.message)
        if not result:
            message.reply_text(f"No results for *{query}*.")
            return

        song, path = result
        add_list = [(song, path, update.message)]

        context.bot_data["song_queue"].extend(add_list)
        if not context.bot_data["now_playing"]:
            queue_player(context)


def queue(update, context):
    if len(context.bot_data["song_queue"]) > 0:
        song_list = context.bot_data["song_queue"]

        text = "<b>Current Queue:</b>\n\n"

        for i, (song, path, message) in enumerate(song_list[:10]):
            song: spotdl.Song
            message: Message

            text += f"{i + 1}. <b>{song.display_name}</b> queued by {message.from_user.first_name}\n"

        if len(song_list) > 10:
            text += "..."

        update.message.reply_text(
            text,
            parse_mode=ParseMode.HTML
        )
    else:
        update.message.reply_text("No songs in queue.")


def status(update, context):
    song_title = context.bot_data["now_playing"]
    if song_title:
        update.message.reply_text(f"Streaming *{song_title}*...")
    else:
        update.message.reply_text("No songs being played by humans 🤖")


if __name__ == "__main__":
    main()
