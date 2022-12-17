from telegram.ext import CommandHandler

from .play import play
from .queue_handler import get_queue, now_playing

# An in memory queue for songs, always has 10 songs
song_queue = []  # { metadata, song_id, automated }

list_of_commands = [
    (["play", "p"], "Play a song from Spotify and/or YouTube.", play),
    (["queue", "q"], "Get the current queue.", get_queue),
    (["nowplaying", "np"], "Get the currently playing song.", now_playing),
]

command_handler_list = []
for (triggers, _, command) in list_of_commands:
    handler = command

    for trigger in triggers:
        command_handler_list.append(CommandHandler(trigger, handler))
