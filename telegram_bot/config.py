import os

keys = {
    "TELEGRAM_TOKEN": os.environ.get("TELEGRAM_TOKEN", None),
    "LOGGING_CHANNEL_ID": os.environ.get("LOGGING_CHANNEL_ID", None),
    "SPOTIFY_CLIENT_ID": os.environ.get("SPOTIFY_CLIENT_ID", None),
    "SPOTIFY_CLIENT_SECRET": os.environ.get("SPOTIFY_CLIENT_SECRET", None),
}

if not keys["TELEGRAM_TOKEN"]:
    raise Exception("TELEGRAM_TOKEN not found. Exiting...")

if not keys["SPOTIFY_CLIENT_ID"] or not keys["SPOTIFY_CLIENT_SECRET"]:
    raise Exception("Spotify credentials not found. Exiting...")
