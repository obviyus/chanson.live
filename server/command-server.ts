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
  const songMetadata = request.body as Record<string, string>;

  const metadata: SongMetadata = {
    title: songMetadata.title,
    artist: songMetadata.artist,
    album: songMetadata.album,
    cover: songMetadata.cover,
  };

  socketHandler.broadcastMetadata(metadata);
  response.json(worker.getProducerPorts());
});

/**
 * Stop producer once transmission is complete.
 */
commandServer.get('/stopProducer', async (_, response) => {
  worker.closeProducer();
  response.sendStatus(200);
});
