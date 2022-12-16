import { createRef, useEffect, useState } from 'react';
import type { Transport } from 'mediasoup-client/lib/Transport';
import type { Consumer } from 'mediasoup-client/lib/Consumer';
import { Device } from 'mediasoup-client';
import { BsGithub, BsHeartFill } from 'react-icons/bs';
import type { ConsumerResponse, SongMetadata } from 'server/types';
import { SocketMessages } from 'server/socket-handler';
import type {
  RtpCapabilities,
  RtpParameters,
} from 'mediasoup-client/lib/RtpParameters';
import { io, type Socket } from 'socket.io-client';

export default function ClientPlayer() {
  /**
   * Each property we need gets its own state variable.
   * TODO: Improve state management (maybe Redux?)
   */
  const [consumerTransport, setConsumerTransport] = useState<Transport>();
  const [consumer, setConsumer] = useState<Consumer>();
  const [device, setDevice] = useState<Device>();
  const [producerId, setProducerId] = useState<string | undefined>(undefined);
  const [metadata, setMetadata] = useState<SongMetadata | undefined>();
  const [clientCount, setClientCount] = useState<number>(0);
  const [socket, setSocket] = useState<Socket>();

  const audio = createRef<HTMLAudioElement>();

  /**
   * Emitter for sending data back to the server.
   * @param type
   * @param data
   */
  async function socketEmit(type: string, data: any): Promise<any> {
    if (!socket) return;

    return new Promise((resolve, reject) => {
      socket.emit(type, data, (response: any) => {
        if (response.error) {
          reject(response.error);
        } else {
          resolve(response);
        }
      });
    });
  }

  /**
   * Create/Update a consumer when a new producer is created.
   */
  function createConsumer() {
    if (consumerTransport && device) {
      console.info(`STARTING_CONSUMER_FOR_TRANSPORT: ${consumerTransport.id}`);
      const { rtpCapabilities } = device;

      socketEmit(SocketMessages.CONSUME, { rtpCapabilities })
        .then((response: ConsumerResponse) => {
          if (response) {
            console.info(`CONSUMING_PRODUCER: ${response.producerId}`);
            consumerTransport
              .consume({
                producerId: response.producerId,
                id: response.id,
                kind: 'audio',
                rtpParameters: response.rtpParameters as RtpParameters,
              })
              .then((consumer: Consumer) => {
                setConsumer(consumer);
              })
              .catch((error: any) => {
                console.error(error);
              });
          }
        })
        .catch((error: any) => {
          console.error(error);
        });
    }
  }

  /**
   * Load a device from the client.
   * @param routerRtpCapabilities
   */
  async function loadDevice(
    routerRtpCapabilities: RtpCapabilities
  ): Promise<Device> {
    try {
      const newDevice = new Device();
      await newDevice.load({ routerRtpCapabilities });

      return newDevice;
    } catch (error: unknown) {
      throw error;
    }
  }

  useEffect(() => {
    const socket = io();
    setSocket(socket);
    return () => {
      socket.close();
    };
  }, []);

  useEffect(() => {
    if (!socket) return;

    socket.on(SocketMessages.CONNECTION, () => {
      console.info('SOCKET_CONNECTED');
    });

    socket.on(
      SocketMessages.CLIENT_COUNT,
      (message: Record<string, string>) => {
        setClientCount(Number.parseInt(message.clientCount, 10));
      }
    );

    socket.on(SocketMessages.ERROR, function (error: Error) {
      console.error(`SOCKET_ERROR: ${error.message}`);
    });

    socket.on(SocketMessages.DISCONNECT, function (event: any) {
      console.warn(`SOCKET_DISCONNECT: ${JSON.stringify(event)}`);
    });

    socket.on(SocketMessages.WELCOME, (message: Record<string, string>) => {
      if (socket.id !== message.id) {
        console.warn(`SOCKET_WARN ID_MISMATCH: ${message.id} != ${socket.id}`);
      }

      console.info(`SOCKET_WELCOME: ${message.id}`);
    });

    socket.on(
      SocketMessages.PRODUCER_STARTED,
      function (message: Record<string, string>) {
        console.info(`SOCKET_NEW_PRODUCER_STARTED: ${message.id}`);
        setProducerId(message.id);
      }
    );

    socket.on(
      SocketMessages.PRODUCER_CLOSED,
      async function (message: Record<string, string>) {
        console.info(`SOCKET_PRODUCER_CLOSED: ${message.id}`);
        setProducerId(undefined);

        if (consumer) {
          consumer.close();
        }

        if (audio.current) {
          audio.current.srcObject = null;
        }
      }
    );

    socket.on(SocketMessages.METADATA, (message: SongMetadata) => {
      setMetadata(message);
    });

    /**
     * Get Router RTP Capabilities.
     */
    socketEmit(SocketMessages.GET_ROUTER_RTP_CAPABILITIES, {})
      .then((routerRtpCapabilities: RtpCapabilities) => {
        loadDevice(routerRtpCapabilities)
          .then((newDevice: Device) => {
            setDevice(newDevice);
          })
          .catch((error: unknown) => {
            console.error(error);
          });
      })
      .catch((error: unknown) => {
        console.error(error);
      });
  }, [socket]);

  /**
   * Create a consumer transport after the client device is loaded.
   */
  useEffect(() => {
    socketEmit(SocketMessages.CREATE_CONSUMER_TRANSPORT, {})
      .then((response: any) => {
        if (device) {
          setConsumerTransport(device.createRecvTransport(response));
        }
      })
      .catch((error: unknown) => {
        console.error(error);
      });
  }, [device]);

  /**
   * Create a consumer when the consumerTransport is created.
   */
  useEffect(() => {
    if (consumerTransport) {
      console.info(`CONSUMER_TRANSPORT_CREATED: ${consumerTransport.id}`);

      consumerTransport.on(
        SocketMessages.CONNECT,
        async ({ dtlsParameters }, callback) => {
          socketEmit(SocketMessages.CONNECT_CONSUMER_TRANSPORT, {
            dtlsParameters,
          })
            .then(callback)
            .catch((error: unknown) => {
              console.error(error);
            });
        }
      );

      consumerTransport.on('connectionstatechange', (state) => {
        switch (state) {
          case 'connecting': {
            console.info('SUBSCRIBER_CONNECTING');
            break;
          }

          case 'connected': {
            console.info('SUBSCRIBER_CONNECTED');
            break;
          }

          case 'failed': {
            console.info('SUBSCRIBER_FAILED');
            break;
          }

          default: {
            break;
          }
        }
      });

      createConsumer();
    }
  }, [consumerTransport]);

  /**
   * Add the audio stream to the page once the consumer is created.
   */
  useEffect(() => {
    if (consumer) {
      console.info(`CONSUMER_CREATED: ${consumer.id}`);

      const stream = new MediaStream();
      stream.addTrack(consumer.track);

      if (audio.current) {
        audio.current.srcObject = stream;
        audio.current
          .play()
          .then(() => {
            console.info('PLAYING_AUDIO');
          })
          .catch((error: unknown) => {
            console.error(error);
          });
      }
    }
  }, [consumer]);

  /**
   * Create a consumer when the producerId is set.
   */
  useEffect(() => {
    if (producerId) {
      console.info(`PRODUCER_CREATED: ${producerId}`);
      console.info(`TRANSPORT: ${consumerTransport?.id}`);
      console.info(`DEVICE: ${device?.loaded}`);
      createConsumer();
    }
  }, [producerId]);

  return (
    <div
      className={
        'flex mx-auto max-w-screen-sm p-2 items-center flex-col pb-16 pt-12 min-h-screen'
      }>
      <h1 className={'text-center text-2xl font-bold'}>Localhost FM 📻</h1>

      <p>{clientCount} listener(s)</p>

      {metadata?.cover && metadata.title && (
        <img
          src={metadata.cover}
          alt={metadata.title}
          className={'max-w-sm mt-10 mx-5 drop-shadow-xl'}
        />
      )}

      <h2 className={'pt-10 text-center font-bold tracking-wide'}>
        {metadata?.title}
      </h2>

      <h2 className={'pt-2 text-center font-semibold tracking-wide'}>
        {metadata?.artist}
      </h2>

      <p className={'pt-2 text-center'}>{metadata?.album}</p>

      <audio
        ref={audio}
        controls={true}
        autoPlay
        preload={'auto'}
        className={'mt-10'}
      />

      <a
        href={'https://obviy.us'}
        className={'text-center mt-10 tracking-wide'}>
        <div className={'flex'}>
          Made with <BsHeartFill className={'mt-1.5 mx-2'} /> by @obviyus
        </div>
      </a>

      <a
        href={'https://github.com/obviyus/radio'}
        className={'text-center font-semibold tracking-wide'}>
        <BsGithub size={'1.5rem'} className={'mt-5'} />
      </a>
    </div>
  );
}
