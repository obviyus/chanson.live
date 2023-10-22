from telegram import Update
from telegram.ext import ContextTypes
from telegram.constants import ParseMode

from commands.queue_handler import update_queue
from commands.search import music_search
from config.db import sqlite_conn


async def play(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """
    Search for a song, download it and push it to the queue. The song will be queued before all
    automated songs but after all manually queued songs.
    """
    message = update.message
    query = " ".join(context.args)

    if not query:
        await message.reply_text(
            "<b>Usage</b>: <pre>/play {SONG_NAME}</pre>\n\n"
            "<b>Example</b>:* <pre>/play Silvertown Blues<pre>",
            parse_mode=ParseMode.HTML,
        )
    else:
        song = await music_search(query, update.message)
        if not song:
            await message.reply_text(
                f"No results found for <b>{query}</b>.", parse_mode=ParseMode.HTML
            )
            return

        metadata = {
            "title": song["name"],
            "artist": song["artists"][0]["name"],
            "album": song["album"]["name"],
            "cover_url": song["album"]["images"][0]["url"],
        }

        cursor = sqlite_conn.cursor()

        cursor.execute(
            """
            SELECT * FROM song_blacklist WHERE song_id = ?;
            """,
            (song["id"],),
        )

        if cursor.fetchone():
            await message.reply_text(f"Song <b>{song.name}</b> is blacklisted.")
            return

        cursor.execute(
            """
            INSERT INTO song_log (song_id, user_id, title, album, artist, cover_url) VALUES (?, ?, ?, ?, ?, ?);
            """,
            (
                song["id"],
                update.effective_user.id,
                metadata["title"],
                metadata["album"],
                metadata["artist"],
                metadata["cover_url"],
            ),
        )

        cursor.execute(
            """
            INSERT INTO song_stats (song_id) VALUES (?) ON CONFLICT (song_id) DO UPDATE SET play_count = play_count + 1;
            """,
            (song["id"],),
        )

        to_queue = {
            "metadata": metadata,
            "song_id": song["id"],
            "automated": False,
            "message": message,
        }

        # Insert into the song queue, before all automated songs
        position_of_first_automated_song = next(
            (
                i
                for i, song in enumerate(context.bot_data["queue"])
                if song["automated"]
            ),
            len(context.bot_data["queue"]),
        )

        position_of_first_automated_song = (
            1
            if position_of_first_automated_song == 0
            else position_of_first_automated_song
        )

        context.bot_data["queue"].insert(position_of_first_automated_song, to_queue)
        await update_queue(context)

        await message.reply_text(
            f"Queued <b>{metadata['title']}</b> by "
            f"<b>{metadata['artist']}</b> at position {position_of_first_automated_song + 1}.",
            parse_mode=ParseMode.HTML,
        )


# async def playlist(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
#     """
#     Search for a playlist, download it and push it to the queue. The playlist will be queued before all
#     automated songs but after all manually queued songs.
#     """
#     message = update.message
#     query = " ".join(context.args)

#     if not query:
#         await message.reply_text(
#             "<b>Usage</b>: <pre>/playlist {PLAYLIST_URL}</pre>\n\n"
#             "<b>Example</b>: <pre>/playlist https://open.spotify.com/playlist/6eUTR6EkuyGEclVM7XiNNc?si=c2f18389df164631</pre>",
#             parse_mode=ParseMode.HTML,
#         )
#     else:
#         results = playlist_search(query, update.message)
#         if not results:
#             await message.reply_text(
#                 f"No results found for <b>{query}</b>.", parse_mode=ParseMode.HTML
#             )
#             return

#         for song in results:
#             metadata = {
#                 "title": song.name,
#                 "artist": song.artist,
#                 "album": song.album_name,
#                 "cover_url": song.cover_url,
#             }

#             cursor = sqlite_conn.cursor()
#             cursor.execute(
#                 """
#                 INSERT INTO song_log (song_id, user_id, title, album, artist, cover_url) VALUES (?, ?, ?, ?, ?, ?);
#                 """,
#                 (
#                     song["id"],
#                     update.effective_user.id,
#                     metadata["title"],
#                     metadata["album"],
#                     metadata["artist"],
#                     metadata["cover_url"],
#                 ),
#             )

#             cursor.execute(
#                 """
#                 INSERT INTO song_stats (song_id) VALUES (?) ON CONFLICT (song_id) DO UPDATE SET play_count = play_count + 1;
#                 """,
#                 (song["id"],),
#             )

#             to_queue = {
#                 "metadata": metadata,
#                 "song_id": song["id"],
#                 "automated": False,
#                 "message": message,
#             }

#             # Insert into the song queue, before all automated songs
#             position_of_first_automated_song = next(
#                 (
#                     i
#                     for i, song in enumerate(context.bot_data["queue"])
#                     if song["automated"]
#                 ),
#                 len(context.bot_data["queue"]),
#             )

#             position_of_first_automated_song = (
#                 1
#                 if position_of_first_automated_song == 0
#                 else position_of_first_automated_song
#             )

#             context.bot_data["queue"].insert(position_of_first_automated_song, to_queue)
#             update_queue(context)

#         await message.reply_text(
#             f"Queued <b>{len(results)}</b> songs from <b>{query}</b>.",
#             parse_mode=ParseMode.HTML,
#         )
