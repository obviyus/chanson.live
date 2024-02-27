import asyncio

import requests
from commands.queue_handler import add_song_to_history, update_queue
from telegram.constants import ParseMode
from telegram.ext import ContextTypes


async def on_process_complete(process, context: ContextTypes.DEFAULT_TYPE):
    await process.wait()

    requests.get("http://127.0.0.1:8082/stopProducer")
    context.bot_data["queue"].pop(0)
    await update_queue(context)

    context.bot_data["PID"] = None


async def queue_player(context: ContextTypes.DEFAULT_TYPE):
    """
    Play the latest song in the queue.
    """
    if len(context.bot_data["queue"]) > 0 and context.bot_data.get("PID") is None:
        song = context.bot_data["queue"][0]
        if "message" in song and song["message"]:
            await song["message"].reply_text(
                f"Playing <b>{song['metadata']['title']}</b> by <b>{song['metadata']['artist']}</b>."
                f"<a href='{song['metadata']['cover_url']}'>&#8205;</a>",
                parse_mode=ParseMode.HTML,
            )

        # Get RTP/RTCP ports from Mediasoup
        response = requests.post(
            "http://127.0.0.1:8082/startProducer",
        ).json()

        cmd = [
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

        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        context.bot_data["PID"] = process.pid
        await add_song_to_history(song["song_id"])

        asyncio.create_task(on_process_complete(process, context))
