# Localhost FM

## ⚠ Extremely Alpha

This is something I threw together over an idle weekend. There's a bunch of improvements I'd like to make:
- improve the hacky `ffmpeg` subprocess to convert the audio to an RTP stream
- `useContext` for the actual wss connection via [Remix](https://github.com/remix-run/examples/tree/main/socket.io)
- add a queue on the website
- ability to request music on the website

You can find a live example here: https://radio.superserio.us/

If nobody's playing music via the [Telegram bot](https://t.me/SSRadioBot), it'll play from a list of previously played songs.
