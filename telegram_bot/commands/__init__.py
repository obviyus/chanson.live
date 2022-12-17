from telegram.ext import CommandHandler

from .moderation import blacklist
from .play import play, playlist
from .queue_handler import get_queue, now_playing, skip

# An in memory queue for songs, always has 10 songs
song_queue = []  # { metadata, song_id, automated }

list_of_commands = [
    (["blacklist", "bl"], "Blacklist the current song.", blacklist),
    (["nowplaying", "np"], "Get the currently playing song.", now_playing),
    (["play", "p"], "Play a song from Spotify and/or YouTube.", play),
    (["playlist", "pl"], "Play a playlist from Spotify.", playlist),
    (["queue", "q"], "Get the current queue.", get_queue),
    (["skip", "s"], "Skip the current song.", skip),
]

command_handler_list = []
for (triggers, _, command) in list_of_commands:
    handler = command

    for trigger in triggers:
        command_handler_list.append(CommandHandler(trigger, handler))
