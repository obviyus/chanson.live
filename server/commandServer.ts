import express from "express";
import { defaultWorker } from "./mediasoupHandler";
import { io } from "./index";

export const commandServer = express();

/**
 * Create a new producer and request its RTP + RTCP ports.
 */
commandServer.get("/startProducer", async (_, res) => {
    await defaultWorker.createDefaultProducer();
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
