import os
import requests


def stream_to_SRT(url: str):
    os.system(f"""ffmpeg -reconnect 1 -reconnect_streamed 1 -reconnect_delay_max 2 -re -i "{url}" -f wav -codec:a pcm_s16le srt://127.0.0.1:10000 """)