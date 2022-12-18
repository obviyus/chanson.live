import express from 'express';
import type { SongMetadata } from './types';
import worker from './mediasoup-handler';
import { socketHandler } from './index';

export const commandServer = express();
commandServer.use(express.json());
commandServer.use(express.urlencoded({ extended: true }));

/**
 * Create a new producer and request its RTP + RTCP ports.
 */
commandServer.post('/startProducer', async (request, response) => {
  await worker.createDefaultProducer();
  const data = request.body as Array<Record<string, string>>;

  const songQueue: SongMetadata[] = data.map((song) => ({
    title: song.title,
    artist: song.artist,
    album: song.album,
    cover: song.cover,
  }));

  socketHandler.broadcastQueue(songQueue);
  response.json(worker.getProducerPorts());
});

/**
 * Stop producer once transmission is complete.
 */
commandServer.get('/stopProducer', async (_, response) => {
  worker.closeProducer();
  response.sendStatus(200);
});
