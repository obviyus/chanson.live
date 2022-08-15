from yt_dlp import YoutubeDL

ydl_opts = {
    'format': 'bestaudio/best',
    "outtmpl": "./media/%(id)s.mp3",
    'postprocessors': [{
        'key': 'FFmpegExtractAudio',
        'preferredcodec': 'mp3',
        'preferredquality': '192',
    }],
}


def search(query: str):
    # Search using yt-dlp
    with YoutubeDL(ydl_opts) as ydl:
        info_dict = ydl.extract_info(f"ytsearch:{query}")
        filename = info_dict["entries"][0]["id"] + ".mp3"

        return f"{filename}", info_dict["entries"][0]["title"]
