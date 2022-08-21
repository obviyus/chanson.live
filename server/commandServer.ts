import express from "express";
import {defaultWorker} from "./mediasoupHandler";
import {io} from "./index";

export const commandServer = express();

commandServer.use(express.json());
commandServer.use(express.urlencoded({extended: true}));

export type SongMetadata = {
    title: null,
    artist: null,
    album: null,
    cover: null,
}

/**
 * Create a new producer and request its RTP + RTCP ports.
 */
commandServer.post("/startProducer", async (req, res) => {
    await defaultWorker.createDefaultProducer();

    const songMetadata = req.body;
    console.log(songMetadata);

    const metadata: SongMetadata = {
        title: songMetadata.title,
        artist: songMetadata.artist,
        album: songMetadata.album,
        cover: songMetadata.cover,
    }

    defaultWorker.broadcastMetadata(metadata);

    res.json({
        "rtpPort": defaultWorker.producerTransport.tuple.localPort,
        "rtcpPort": defaultWorker.producerTransport.rtcpTuple?.localPort,
    });
});

/**
 * Stop producer once transmission is complete.
 */
commandServer.get("/stopProducer", async (_, res) => {
    await defaultWorker.producer.close();
    io.sockets.emit("producerClosed", {});

    res.sendStatus(200);
});
