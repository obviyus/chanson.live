import logging
import os
import signal
import subprocess
import threading

from telegram import ParseMode
from telegram.ext import (Updater, CommandHandler, Defaults)

from media import search


def start(update, context):
    """Start bot"""
    context.bot.send_message(
        chat_id=update.effective_chat.id,
        text="Hi."
    )


def main():
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

    defaults = Defaults(parse_mode=ParseMode.MARKDOWN)
    updater = Updater(
        token='', defaults=defaults
    )

    dispatcher = updater.dispatcher
    dispatcher.add_handler(CommandHandler('play', play, run_async=True))
    dispatcher.add_handler(CommandHandler('skip', skip, run_async=True))
    dispatcher.add_handler(CommandHandler('status', status, run_async=True))
    dispatcher.add_handler(CommandHandler('clear', skip, run_async=True))

    updater.start_polling(clean=True)
    print("Started bot")

    updater.idle()


def clear(update, context):
    context.bot_data['song_queue'] = None
    skip(update, context)

    update.message.reply_text(
        text=f"Queue cleared.",
        parse_mode='Markdown',
    )


def song_queue(update, context):
    while context.bot_data['song_queue']:
        song_url, song_title = context.bot_data['song_queue'][0]
        context.bot_data['now_playing'] = song_title

        update.message.reply_text(
            text=f"Streaming *{song_title}*...",
            parse_mode='Markdown',
        )

        p = subprocess.Popen(
            f"""ffmpeg -reconnect 1 -reconnect_streamed 1 -reconnect_delay_max 2 -re -i "{song_url}" -f wav -codec:a pcm_s16le srt://127.0.0.1:10000"""
        )
        context.bot_data['PID'] = p.pid
        p.wait()

        context.bot_data['song_queue'].pop(0)
        context.bot_data['now_playing'] = None


def skip(update, context):
    try:
        pid = context.bot_data['PID']
        if not pid:
            raise KeyError
        update.message.reply_text(
            text=f"Skipping...",
            parse_mode='Markdown',
            disable_web_page_preview=False,
        )

        os.kill(pid, signal.CTRL_BREAK_EVENT)
        context.bot_data['PID'] = None

    except KeyError:
        update.message.reply_text(
            text=f"No more songs in queue.",
            parse_mode='Markdown',
            disable_web_page_preview=False,
        )


def play(update, context):
    message = update.message
    song = ' '.join(context.args)

    if not song:
        text = "*Usage:* `/play {SONG_NAME}`\n" \
               "*Example:* `/hltb Silvertown Blues`"
        message.reply_text(
            text=text,
            parse_mode='Markdown',
            disable_web_page_preview=False,
        )
    else:
        song_url, song_title = search(song)
        try:
            if not context.bot_data['song_queue']:
                raise KeyError

            context.bot_data['song_queue'].append((song_url, song_title))
            message.reply_text(
                text=f"Adding *{song_title}* to queue...",
                parse_mode='Markdown',
            )
        except KeyError:
            context.bot_data['song_queue'] = [(song_url, song_title)]

            message.reply_text(
                text=f"Starting queue...",
                parse_mode='Markdown',
            )

        try:
            if context.bot_data['now_playing'] is None:
                raise KeyError
        except KeyError:
            context.bot_data['now_playing'] = None
            threading.Thread(song_queue(update, context))


def status(update, context):
    try:
        song_title = context.bot_data['now_playing']
        if not song_title:
            raise KeyError

        update.message.reply_text(
            text=f"Streaming *{song_title}*...\n\n📻 Join on [http://122.161.26.37:8080/live.m3u8]("
                 f"http://122.161.26.37:8080/live.m3u8)",
            parse_mode='Markdown',
            disable_web_page_preview=False,
        )
    except KeyError:
        update.message.reply_text(
            text=f"No songs being played by humans 🤖",
            parse_mode='Markdown',
            disable_web_page_preview=False,
        )


if __name__ == '__main__':
    main()
