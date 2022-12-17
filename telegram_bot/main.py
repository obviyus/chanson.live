import datetime
import html
import json
import traceback

from telegram import ParseMode, Update
from telegram.ext import CallbackContext, Updater

from commands import command_handler_list, list_of_commands
from commands.queue_handler import queue_builder
from config import config, logger
from player import queue_player


def start(update: Update, _: CallbackContext) -> None:
    """
    Start command handler.
    """
    update.message.reply_text(f"👋 @{update.effective_user.username}")
    logger.info(f"/start command received from @{update.effective_user.username}")


def post_init(context: CallbackContext) -> None:
    """
    Initialise the bot.
    """
    logger.info(f"Started @{context.bot.username} (ID: {context.bot.id})")

    if (
        "LOGGING_CHANNEL_ID" in config["TELEGRAM"]
        and config["TELEGRAM"]["LOGGING_CHANNEL_ID"]
    ):
        logger.info(
            f"Logging to channel ID: {config['TELEGRAM']['LOGGING_CHANNEL_ID']}"
        )

        context.bot.send_message(
            chat_id=config["TELEGRAM"]["LOGGING_CHANNEL_ID"],
            text=f"📝 Started @{context.bot.username} (ID: {context.bot.id}) at {datetime.datetime.now()}",
        )

    # Set commands for bot instance
    context.bot.set_my_commands(
        [(command[0][0], command[1]) for command in list_of_commands]
    )

    context.bot_data["queue"] = []
    context.bot_data["PID"] = None


def error_handler(update: object, context: CallbackContext) -> None:
    """Log the error and send a telegram message to notify the developer."""
    # Log the error before we do anything else, so we can see it even if something breaks.
    logger.error(msg="Exception while handling an update:", exc_info=context.error)

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

    if (
        "LOGGING_CHANNEL_ID" in config["TELEGRAM"]
        and config["TELEGRAM"]["LOGGING_CHANNEL_ID"]
    ):
        # Finally, send the message
        context.bot.send_message(
            chat_id=config["TELEGRAM"]["LOGGING_CHANNEL_ID"],
            text=message,
            parse_mode=ParseMode.HTML,
        )


def main():
    updater = Updater(token=config["TELEGRAM"]["TOKEN"])

    updater.dispatcher.add_error_handler(error_handler)
    job_queue = updater.job_queue

    for command in command_handler_list:
        updater.dispatcher.add_handler(command)

    job_queue.run_once(post_init, 0)

    # Every 30s check if there's at least 10 songs in the queue
    job_queue.run_repeating(queue_builder, interval=30, first=30)

    # Check every 5s if there's a song playing
    job_queue.run_repeating(queue_player, interval=10, first=10)

    updater.start_polling()
    updater.idle()


if __name__ == "__main__":
    main()
