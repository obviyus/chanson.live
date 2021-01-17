import os

import pafy


def backup_stream(playlist_address: str):
    playlist = pafy.get_playlist(playlist_address)
    for song in playlist['items']:
        try:
            stream_to_SRT(song['pafy'].getbestaudio().url)
        except OSError:
            pass


def stream_to_SRT(url: str):
    os.system(
        f"""ffmpeg -reconnect 1 -reconnect_streamed 1 -reconnect_delay_max 2 -re -i "{url}" -f wav -codec:a pcm_s16le srt://127.0.0.1:10001 """)


while True:
    backup_stream('https://www.youtube.com/playlist?list=PL9D478540A2B59FF4')
