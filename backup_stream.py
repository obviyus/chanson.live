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
    exit_code = os.system(
        f'ffmpeg '
        f'-reconnect 1 '
        f'-reconnect_streamed 1 '
        f'-reconnect_delay_max 2 '
        f'-re '
        f'-i "{url}" '
        f'-f wav '
        f'-codec:a pcm_s16le '
        f'srt://127.0.0.1:10001'
    )
    if exit_code == 2:
        raise KeyboardInterrupt


while True:
    try:
        backup_stream('https://www.youtube.com/playlist?list=PL9D478540A2B59FF4')
    except KeyboardInterrupt:
        break
