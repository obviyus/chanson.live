import re
import urllib.parse
import urllib.request

import pafy


def search(query: str):
    query_string = urllib.parse.urlencode({"search_query": query})
    url = urllib.request.urlopen("https://www.youtube.com/results?" + query_string)

    search_results = re.findall(r"watch\?v=(\S{11})", url.read().decode())
    first_result = "https://www.youtube.com/watch?v=" + "{}".format(search_results[0])

    video = pafy.new(first_result)
    return video.getbestaudio().url, video.title
