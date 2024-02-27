from functools import lru_cache
from pathlib import Path

import spotipy
import yt_dlp
from config import config
from spotipy.oauth2 import SpotifyClientCredentials
from telegram import Message
from telegram.constants import ParseMode

sp = spotipy.Spotify(
    auth_manager=SpotifyClientCredentials(
        client_id=config["API"]["SPOTIFY_CLIENT_ID"],
        client_secret=config["API"]["SPOTIFY_CLIENT_SECRET"],
    )
)


def get_song_metadata_by_name(song_name):
    # Search for the song on Spotify
    results = sp.search(q=song_name, type="track", limit=1)
    if not results["tracks"]["items"]:
        raise ValueError(f"No track found for {song_name}")

    # Get the first (most relevant) track from the search results
    return results["tracks"]["items"][0]


def download_song(song_title, song_artist, song_id):
    ydl_opts = {
        "default_search": "ytsearch",
        "format": "bestaudio/best",
        "outtmpl": f"./downloads/{song_id}.%(ext)s",
        "postprocessors": [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "opus",
                "preferredquality": "192",
            }
        ],
    }

    query = f"{song_title} {song_artist}"
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.download([query])


@lru_cache(maxsize=None)
async def music_search(query: str, message: Message = None):
    song_metadata = get_song_metadata_by_name(query)

    if song_metadata:
        if message:
            await message.reply_text(
                f"Adding <b>{song_metadata['name']}</b> by <b>{song_metadata['artists'][0]['name']}</b> to the queue."
                f"<a href='{song_metadata['album']['images'][0]['url']}'>&#8205;</a>",
                parse_mode=ParseMode.HTML,
            )

        if Path(f"./downloads/{song_metadata['id']}.opus").exists():
            return song_metadata

        download_song(
            song_metadata["name"],
            song_metadata["artists"][0]["name"],
            song_metadata["id"],
        )

        return song_metadata


# @lru_cache(maxsize=None)
# async def playlist_search(query: str, message: Message):
#     """
#     Queue all songs from a YouTube playlist.
#     """
#     if message:
#         await message.reply_text(
#             f"Searching for <b>{query}</b>. This might take a while.",
#             parse_mode=ParseMode.HTML,
#         )

#     playlist = get_song_metadata_by_name(query)
#     if not playlist:
#         await message.reply_text(f"No results for *{query}*.")
#         return

#     result = []

#     for playlist_item in playlist:
#         logger.info(f"Queued {playlist_item.display_name} by {playlist_item.artist}.")

#         if Path(f"./downloads/{playlist_item.song_id}.opus").exists():
#             result.append(playlist_item)
#             continue

#         song, path = await download_song(playlist_item)
#         if not song.song_id:
#             song.song_id = playlist_item.song_id

#         try:
#             os.rename(path, f"./downloads/{playlist_item.song_id}.opus")
#         except TypeError:
#             continue

#         result.append(playlist_item)

#     return result
