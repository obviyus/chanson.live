import datetime
import html
import json
import logging
import traceback

from commands import command_handler_list
from commands.queue_handler import queue_builder
from config import config, logger
from player import queue_player
from telegram import Update
from telegram.constants import ParseMode
from telegram.ext import (
    AIORateLimiter,
    Application,
    ApplicationBuilder,
    CommandHandler,
    ContextTypes,
)


async def start(update: Update, _: ContextTypes.DEFAULT_TYPE):
    """
    Start command handler.
    """
    await update.message.reply_text(
        f"👋 @{update.effective_user.username}"
        f"\n\n I'm a bot that plays music from Spotify and/or YouTube on a WebRTC radio @ https://radio.obviy.us."
        f"\n\nYou can request music using /play"
    )


async def post_init(application: Application) -> None:
    """
    Initialise the bot.
    """
    logger.info(f"Started @{application.bot.username} (ID: {application.bot.id})")

    if (
        "LOGGING_CHANNEL_ID" in config["TELEGRAM"]
        and config["TELEGRAM"]["LOGGING_CHANNEL_ID"]
    ):
        logger.info(
            f"Logging to channel ID: {config['TELEGRAM']['LOGGING_CHANNEL_ID']}"
        )

        await application.bot.send_message(
            chat_id=config["TELEGRAM"]["LOGGING_CHANNEL_ID"],
            text=f"📝 Started @{application.bot.username} (ID: {application.bot.id}) at {datetime.datetime.now()}",
        )

    application.bot_data["queue"] = []
    application.bot_data["PID"] = None


async def error_handler(update: object, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Log the error and send a telegram message to notify the developer."""
    logging.error(msg="Exception while handling an update:", exc_info=context.error)

    # traceback.format_exception returns the usual python message about an exception, but as a
    # list of strings rather than a single string, so we have to join them together.
    tb_list = traceback.format_exception(
        None, context.error, context.error.__traceback__
    )

    # Build the message with some markup and additional information about what happened.
    # You might need to add some logic to deal with messages longer than the 4096-character limit.
    update_str = update.to_dict() if isinstance(update, Update) else str(update)
    message = (
        f"An exception was raised while handling an update:\n\n"
        f"<pre>update = {html.escape(json.dumps(update_str, indent=2, ensure_ascii=False))}"
        "</pre>\n\n"
        f"<pre>{html.escape(''.join([tb_list[-1], tb_list[-2]]))}</pre>"
    )

    if config["TELEGRAM"]["LOGGING_CHANNEL_ID"]:
        # Finally, send the message
        await context.bot.send_message(
            chat_id=config["TELEGRAM"]["LOGGING_CHANNEL_ID"],
            text=message,
            parse_mode=ParseMode.HTML,
        )


def main():
    logging.info("Loading config...")
    application = (
        ApplicationBuilder()
        .token(config["TELEGRAM"]["TOKEN"])
        .rate_limiter(AIORateLimiter(max_retries=10))
        .post_init(post_init)
        .concurrent_updates(True)
        .build()
    )

    job_queue = application.job_queue
    job_queue.run_once(post_init, 0)

    # Every 30s check if there's at least 10 songs in the queue
    job_queue.run_repeating(queue_builder, interval=30, first=30)

    # Check every 5s if there's a song playing
    job_queue.run_repeating(queue_player, interval=5, first=5)

    logging.info("Starting bot...")
    application.add_error_handler(error_handler)

    application.add_handlers(
        {
            0: [
                CommandHandler("start", start),
                *command_handler_list,
            ],
        }
    )

    application.run_polling()


if __name__ == "__main__":
    main()
