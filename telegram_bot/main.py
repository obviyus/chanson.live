import logging
import os
import signal
from datetime import time

import spotdl
from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Message, ParseMode, Update
from telegram.ext import CallbackContext, CallbackQueryHandler, CommandHandler, Updater

import config
from player import music_search, playlist_search, queue_player


def start(update: Update, _: CallbackContext):
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
    dispatcher.add_handler(CommandHandler('playlist', playlist, run_async=True))
    dispatcher.add_handler(CommandHandler('skip', skip, run_async=True))
    dispatcher.add_handler(CommandHandler('status', status, run_async=True))
    dispatcher.add_handler(CommandHandler('q', queue, run_async=True))
    dispatcher.add_handler(CommandHandler('clear', clear, run_async=True))
    dispatcher.add_handler(CommandHandler('start', start, run_async=True))
    dispatcher.add_handler(CallbackQueryHandler(callback=remove_queue_callback_handler, run_async=True))

    dispatcher.bot_data['now_playing'] = None
    dispatcher.bot_data['song_queue'] = []
    dispatcher.bot_data['PID'] = None

    updater.start_polling(drop_pending_updates=True)

    logging.info(f"Started @{dispatcher.bot.username} at {time()}")
    updater.job_queue.run_once(queue_player, when=0)

    updater.idle()


def clear(update, context):
    context.bot_data["song_queue"] = context.bot_data["song_queue"][:1]
    update.message.reply_text("Queue cleared.")


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


def playlist(update, context):
    query = " ".join(context.args)

    if not query:
        update.message.reply_text(
            "*Usage:* `/playlist {PLAYLIST_NAME}`\n" "*Example:* `/playlist Silvertown Blues`"
        )
        return

    playlist_search(query, context, update.message)


def queue_keyboard_builder(song_list):
    keyboard = []

    for i, (song, path, message) in enumerate(song_list[:5]):
        song: spotdl.Song
        message: Message

        keyboard.append(
            [
                InlineKeyboardButton(
                    song.display_name,
                    callback_data=f"""skip_id:{song.song_id}""",
                )
            ]
        )

    if len(song_list) > 10:
        keyboard.append(
            [
                InlineKeyboardButton(
                    f"... and {len(song_list) - 10} more",
                    callback_data="",
                )
            ]
        )

    return InlineKeyboardMarkup(keyboard)


def queue(update, context: CallbackContext):
    if len(context.bot_data["song_queue"]) > 0:
        song_list = context.bot_data["song_queue"]

        update.message.reply_text(
            f"{len(song_list)} songs in queue. Tap on a song to remove it:",
            reply_markup=queue_keyboard_builder(song_list),
        )
    else:
        update.message.reply_text("No songs in queue.")


def remove_queue_callback_handler(update, context):
    query_data = update.callback_query.data.replace("skip_id:", "")
    if not query_data:
        return

    song_id = query_data
    context.bot_data["song_queue"] = filter(
        lambda x: x[0].song_id != song_id, context.bot_data["song_queue"]
    )

    update.callback_query.answer(
        text="Removed from queue.", show_alert=True
    )

    update.callback_query.edit_message_text(
        text=f"{len(context.bot_data['song_queue'])} songs in queue.",
        reply_markup=queue_keyboard_builder(context.bot_data["song_queue"]),
    )


def status(update, context):
    song = context.bot_data["now_playing"]
    if song:
        update.message.reply_text(
            f"Playing <b>{song.display_name}</b> by <b>{song.artist}</b>."
            f"<a href='{song.cover_url}'>&#8205;</a>",
            parse_mode=ParseMode.HTML,
        )
    else:
        update.message.reply_text("No songs being played 🤖")


if __name__ == "__main__":
    main()
