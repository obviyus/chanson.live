import subprocess
from pathlib import Path

import requests
from telegram import ParseMode
from telegram.ext import CallbackContext

from commands.queue_handler import update_queue


def queue_player(context: CallbackContext):
    """
    Play the latest song in the queue.
    """
    if len(context.bot_data["queue"]) > 0 and context.bot_data.get("PID") is None:
        song = context.bot_data["queue"][0]
        if "message" in song and song["message"]:
            song["message"].reply_text(
                f"Playing <b>{song['metadata']['title']}</b> by <b>{song['metadata']['artist']}</b>."
                f"<a href='{song['metadata']['cover_url']}'>&#8205;</a>",
                parse_mode=ParseMode.HTML,
            )

        if not Path(f"./downloads/{song['song_id']}.opus").exists():
            return

        song_queue = []
        for song in context.bot_data["queue"]:
            song_queue.append(
                {
                    "title": song["metadata"]["title"],
                    "artist": song["metadata"]["artist"],
                    "album": song["metadata"]["album"],
                    "cover": song["metadata"]["cover_url"],
                }
            )

        # Get RTP/RTCP ports from Mediasoup
        response = requests.post(
            "http://127.0.0.1:8081/startProducer",
            # Send song queue
            json=song_queue,
        ).json()

        p = subprocess.Popen(
            [
                "ffmpeg",
                "-nostats",
                "-loglevel",
                "0",
                "-re",
                "-i",
                f"./downloads/{song['song_id']}.opus",
                "-q:a",
                "0",
                "-map",
                "a",
                "-acodec",
                "libopus",
                "-f",
                "tee",
                f"[select=a:f=rtp:ssrc=11111111:payload_type=101]rtp://127.0.0.1:{response['rtpPort']}?rtcpport={response['rtcpPort']}",
            ]
        )

        context.bot_data["PID"] = p.pid
        p.wait()

        requests.get("http://127.0.0.1:8081/stopProducer")
        context.bot_data["queue"].pop(0)
        update_queue(context)

        context.bot_data["PID"] = None
