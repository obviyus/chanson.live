import os
from functools import lru_cache
from pathlib import Path
from typing import List

from spotdl import Song, Spotdl
from telegram import Message, ParseMode

from config import config, logger

spotdl = Spotdl(
    headless=True,
    client_id=config["API"]["SPOTIFY_CLIENT_ID"],
    client_secret=config["API"]["SPOTIFY_CLIENT_SECRET"],
    no_cache=False,
    audio_providers=["youtube-music", "youtube"],
    cache_path=".spotdl-cache",
    bitrate="128k",
    output_format="opus",
    output="./downloads",
)


@lru_cache(maxsize=None)
def music_search(query: str, message: Message = None) -> Song | None:
    song_list = spotdl.search(
        [query],
    )

    if song_list:
        if message:
            message.reply_text(
                f"Adding <b>{song_list[0].display_name}</b> by <b>{song_list[0].artist}</b> to the queue."
                f"<a href='{song_list[0].cover_url}'>&#8205;</a>",
                parse_mode=ParseMode.HTML,
            )

        if Path(f"./downloads/{song_list[0].song_id}.opus").exists():
            return song_list[0]

        song, path = spotdl.download(song_list[0])
        if not song.song_id:
            song.song_id = song_list[0].song_id

        try:
            os.rename(path, f"./downloads/{song.song_id}.opus")
        except Exception:
            return

        return song


@lru_cache(maxsize=None)
def playlist_search(query: str, message: Message) -> List[Song] | None:
    if message:
        message.reply_text(
            f"Searching for <b>{query}</b>. This might take a while.",
            parse_mode=ParseMode.HTML,
        )

    playlist = spotdl.search([query])
    if not playlist:
        message.reply_text(f"No results for *{query}*.")
        return

    result = []

    for playlist_item in playlist:
        logger.info(f"Queued {playlist_item.display_name} by {playlist_item.artist}.")

        if Path(f"./downloads/{playlist_item.song_id}.opus").exists():
            result.append(playlist_item)
            continue

        song, path = spotdl.download(playlist_item)
        if not song.song_id:
            song.song_id = playlist_item.song_id

        try:
            os.rename(path, f"./downloads/{playlist_item.song_id}.opus")
        except TypeError:
            continue

        result.append(playlist_item)

    return result
