import logging
import os
import signal
import subprocess
import threading

import requests
from telegram import MessageEntity, ParseMode
from telegram.ext import CommandHandler, Defaults, Updater

from media import search


# import spotipy
# spotify = spotipy.Spotify(auth_manager=spotipy.SpotifyClientCredentials())


def start(update, context):
    """Start bot"""
    update.message.reply_text("Hi.")


def main():
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )

    defaults = Defaults(parse_mode=ParseMode.MARKDOWN, quote=False)
    updater = Updater(token=os.environ.get("TG_BOT_TOKEN"), defaults=defaults)

    dispatcher = updater.dispatcher
    dispatcher.add_handler(CommandHandler("play", play, run_async=True))
    dispatcher.add_handler(CommandHandler("playnext", play, run_async=True))
    dispatcher.add_handler(CommandHandler("skip", skip, run_async=True))
    dispatcher.add_handler(CommandHandler("status", status, run_async=True))
    dispatcher.add_handler(CommandHandler("q", queue, run_async=True))
    dispatcher.add_handler(CommandHandler("clear", clear, run_async=True))

    dispatcher.bot_data["now_playing"] = ""
    dispatcher.bot_data["song_queue"] = []
    dispatcher.bot_data["PID"] = None

    updater.start_polling(clean=True)
    print("Started bot")

    updater.idle()


def clear(update, context):
    context.bot_data["song_queue"] = context.bot_data["song_queue"][:1]
    update.message.reply_text("Queue cleared.")


# def spotify_playlist(url, update, context):
#     playlist = spotify.playlist(url)["tracks"]["items"]
#     count = 0
#     add_list = []

#     for track in playlist:
#         query = track["track"]["name"] + " ".join(
#             [artist["name"] for artist in track["track"]["artists"]]
#         )
#         song_url, song_title = search(query)
#         add_list.append((song_url, song_title))
#         count += 1

#     update.message.reply_text(f"{count} songs added to queue.")
#     return add_list


def song_queue(update, context):
    while context.bot_data["song_queue"]:
        song_url, song_title = context.bot_data["song_queue"][0]
        context.bot_data["now_playing"] = song_title

        update.message.reply_text(f"Streaming *{song_title}*...")

        response = requests.get("http://127.0.0.1:8081/startProducer").json()
        p = subprocess.Popen(
            [
                "ffmpeg",
                "-re",
                "-v",
                "info",
                "-i",
                f"./media/{song_url}",
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

        context.bot_data["song_queue"].pop(0)
        context.bot_data["now_playing"] = ""


def skip(update, context):
    pid = context.bot_data["PID"]

    if pid:
        os.kill(pid, signal.SIGINT)
        context.bot_data["PID"] = None
        update.message.reply_text("Skipped")
    else:
        update.message.reply_text("No more songs in queue.")


def play(update, context):
    message = update.message
    song = " ".join(context.args)
    cmd = list(message.parse_entities([MessageEntity.BOT_COMMAND]).values())[0]
    append = True if cmd == "/play" else False

    if not song:
        message.reply_text(
            "*Usage:* `/play {SONG_NAME}`\n" "*Example:* `/play Silvertown Blues`"
        )
    else:
        song_url, song_title = search(song)
        add_list = [(song_url, song_title)]
        message.reply_text(f"Adding *{song_title}* to queue...")

        if append:
            context.bot_data["song_queue"].extend(add_list)
        else:
            context.bot_data["song_queue"][1:1] = add_list

        if not context.bot_data["now_playing"]:
            threading.Thread(song_queue(update, context))


def queue(update, context):
    if context.bot_data["song_queue"]:
        song_list = context.bot_data["song_queue"]

        text = "*Current Queue:*\n\n"
        for i, song in enumerate(song_list[:10]):
            text += str(i + 1) + ". " + song[1] + "\n"
        if len(song_list) > 10:
            text += "..."

        update.message.reply_text(text)
    else:
        update.message.reply_text("No songs in queue")


def status(update, context):
    song_title = context.bot_data["now_playing"]
    if song_title:
        update.message.reply_text(f"Streaming *{song_title}*...")
    else:
        update.message.reply_text("No songs being played by humans 🤖")


if __name__ == "__main__":
    main()
