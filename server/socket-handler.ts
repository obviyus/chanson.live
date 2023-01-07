// eslint-disable-next-line unicorn/prefer-node-protocol
import * as http from 'http';
import type Express from 'express';
import type { Socket } from 'socket.io';
import { Server } from 'socket.io';
import type { SongMetadata } from './types';
import worker from './mediasoup-handler';

export enum SocketMessages {
  CLIENT_COUNT = 'CLIENT_COUNT',
  CLOSE = 'CLOSE',
  CONNECT = 'connect',
  CONNECT_CONSUMER_TRANSPORT = 'CONNECT_CONSUMER_TRANSPORT',
  CONNECT_ERROR = 'CONNECT_ERROR',
  CONNECTION = 'connection',
  CONSUME = 'CONSUME',
  CREATE_CONSUMER_TRANSPORT = 'CREATE_CONSUMER_TRANSPORT',
  DISCONNECT = 'disconnect',
  ERROR = 'ERROR',
  GET_ROUTER_RTP_CAPABILITIES = 'GET_ROUTER_RTP_CAPABILITIES',
  PRODUCER_CLOSED = 'PRODUCER_CLOSED',
  PRODUCER_STARTED = 'PRODUCER_STARTED',
  QUEUE = 'QUEUE',
  WELCOME = 'WELCOME',
}

type CallbackFunction = (data: any) => void;

export class SocketHandler {
  private readonly io: Server;
  private clientCount: number;
  private queue: any;

  constructor(app: Express.Express, port: number) {
    const index = new http.Server(app);
    this.clientCount = 0;

    this.io = new Server(index, {
      cors: {
        origin: '*',
      },
    });

    index.listen(port, '0.0.0.0', () => {
      console.log(`Express and Socket server listening on :${port}`);
    });

    this.io.on(SocketMessages.CONNECTION, (socket: Socket) => {
      this.clientCount = this.io.engine.clientsCount as number;
      this.broadcastClientCount();
      console.log(
        `Client connected: ${socket.id}; Total clients: ${this.clientCount}`
      );

      /**
       * Handle client disconnection.
       */
      socket.on(SocketMessages.DISCONNECT, () => {
        this.clientCount = this.io.engine.clientsCount as number;
        console.log(
          `Client disconnected: ${socket.id}; Total clients: ${this.clientCount}`
        );

        this.broadcastClientCount();
      });

      /**
       * Log socket errors.
       */
      socket.on(SocketMessages.ERROR, (error: Error) => {
        console.error(
          `Error on socket: ${socket.id}: ${JSON.stringify(error)}`
        );
      });

      socket.on(SocketMessages.CONNECT_ERROR, (error: Error) => {
        console.error(
          `Client connection error on socket: ${socket.id}: ${JSON.stringify(
            error
          )}`
        );
      });

      /**
       * Handle GET_ROUTER_RTP_CAPABILITIES request.
       */
      socket.on(
        SocketMessages.GET_ROUTER_RTP_CAPABILITIES,
        (_, callback: CallbackFunction) => {
          callback(worker.getRtpCapabilities());
        }
      );

      /**
       * Handle createConsumerTransport request.
       */
      socket.on(
        SocketMessages.CREATE_CONSUMER_TRANSPORT,
        async (_, callback: CallbackFunction) => {
          console.log(
            `Received createConsumerTransport request from client: ${socket.id}`
          );

          const consumerTransport = await worker.createWebRTCTransport(
            socket.id
          );

          consumerTransport.observer.on('close', () => {
            console.log(`Consumer transport closed: ${consumerTransport.id}`);
            worker.closeConsumer(consumerTransport.id);
          });

          callback({
            id: consumerTransport.id,
            iceParameters: consumerTransport.iceParameters,
            iceCandidates: consumerTransport.iceCandidates,
            dtlsParameters: consumerTransport.dtlsParameters,
          });

          socket.emit(SocketMessages.QUEUE, this.queue);
        }
      );

      /**
       * Handle connectConsumerTransport request.
       */
      socket.on(
        SocketMessages.CONNECT_CONSUMER_TRANSPORT,
        async (data, callback: CallbackFunction) => {
          console.log(
            `Received connectConsumerTransport request from client: ${socket.id}`
          );

          const result = await worker.connectConsumerTransport(
            socket.id,
            data.dtlsParameters
          );

          callback(result);
        }
      );

      /**
       * Handle consume request.
       */
      socket.on(
        SocketMessages.CONSUME,
        async (data, callback: CallbackFunction) => {
          const { producer } = worker;
          if (!producer) {
            console.error(`No producers ready to consume`);
            callback({ error: 'No producers ready to consume' });
            return;
          }

          const result = await worker.consume(socket.id, data.rtpCapabilities);
          callback(result);
        }
      );

      /**
       * Emit a welcome message to complete the connection.
       */
      console.log(`Emitting welcome message to client: ${socket.id}`);
      socket.emit(SocketMessages.WELCOME, {
        type: SocketMessages.WELCOME,
        id: socket.id,
        message: 'Welcome to chanson.live!',
      });

      /**
       * Send the current queue
       */
      socket.emit(SocketMessages.QUEUE, this.queue);
    });
  }

  /**
   * Emit to all connected clients that the producer has closed.
   * @param producerID
   */
  public broadcastProducerClosed(producerID: string) {
    this.broadcastMessage(SocketMessages.PRODUCER_CLOSED, {
      id: producerID,
    });
  }

  /**
   * Emit to all connected clients that a new producer has been started.
   * @param producerID
   */
  public broadcastProducerCreated(producerID: string) {
    this.broadcastMessage(SocketMessages.PRODUCER_STARTED, {
      id: producerID,
    });
  }

  /**
   * Emit to all connected clients the new queue of songs.
   * @param queue
   */
  public broadcastQueue(queue: SongMetadata[]) {
    this.queue = queue;
    this.broadcastMessage(SocketMessages.QUEUE, this.queue);
  }

  /**
   * Send a message to all connected clients.
   * @param message The message to send.
   * @param data The data to send.
   **/
  private broadcastMessage(message: string, data: any) {
    this.io.sockets.emit(message, data);
  }

  /**
   * Send a client count update to all connected clients.
   */
  private broadcastClientCount() {
    this.broadcastMessage(SocketMessages.CLIENT_COUNT, {
      clientCount: this.io.engine.clientsCount as number,
    });
  }
}
