import os


def stream_to_SRT(url: str):
    os.system(
        f'ffmpeg '
        f'-reconnect 1 '
        f'-reconnect_streamed 1 '
        f'-reconnect_delay_max 2 '
        f'-re -i "{url}" '
        f'-f wav '
        f'-codec:a pcm_s16le '
        f'srt://127.0.0.1:10000'
    )
