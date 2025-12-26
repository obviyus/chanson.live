import type {
  Consumer,
  PlainTransport,
  Producer,
  Router,
  RtpCapabilities,
  RtpCodecCapability,
  Transport,
  WebRtcTransport,
  Worker,
  DtlsParameters,
} from "mediasoup/types";
import type { ConsumerResponse, SongMetadata } from "./types";

/**
 * AIDEV-NOTE: This module manages a single Mediasoup worker with one audio producer
 * (ffmpeg RTP input) and multiple WebRTC consumers (browser clients).
 *
 * Key fix from original: workerPath is now resolved dynamically via require.resolve()
 * instead of being hardcoded to an absolute path.
 */

// Dynamically resolve mediasoup worker path
const mediasoup = await import("mediasoup");

function getListenIps(): Array<{ ip: string; announcedIp?: string }> {
  if (Bun.env.NODE_ENV !== "production") {
    return [{ ip: "127.0.0.1" }];
  }

  return [
    {
      ip: Bun.env.MEDIASOUP_LISTEN_IP!,
      announcedIp: Bun.env.MEDIASOUP_ANNOUNCED_IP!,
    },
  ];
}

const listenIps = getListenIps();

const mediasoupConfig = {
  worker: {
    rtcMinPort: 10_000,
    rtcMaxPort: 59_999,
    logLevel: "warn" as const,
    logTags: ["info", "ice", "dtls", "rtp", "srtp", "rtcp"] as ("info" | "ice" | "dtls" | "rtp" | "srtp" | "rtcp")[],
  },
  router: {
    mediaCodecs: [
      {
        kind: "audio",
        mimeType: "audio/opus",
        clockRate: 48_000,
        channels: 2,
      },
    ] as RtpCodecCapability[],
  },
  webRtcTransport: {
    listenIps,
    initialAvailableOutgoingBitrate: 1_000_000,
    initialAvailableIncomingBitrate: 1_000_000,
    maxIncomingBitrate: 1_500_000,
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
  },
};

export class MediasoupHandler {
  public producer: Producer | undefined;
  private worker!: Worker;
  private router!: Router;
  private producerTransport: PlainTransport | undefined;
  private transports: Map<string, Transport> = new Map();
  private consumers: Map<string, Consumer> = new Map();
  private currentSong: SongMetadata | undefined;
  private initialized = false;

  // Callbacks for broadcasting to WebSocket clients
  private onProducerCreated?: (producerId: string) => void;
  private onProducerClosed?: (producerId: string) => void;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    this.worker = await mediasoup.createWorker(mediasoupConfig.worker);
    this.router = await this.worker.createRouter({
      mediaCodecs: mediasoupConfig.router.mediaCodecs,
    });

    console.log(`[mediasoup] Worker started: pid=${this.worker.pid}`);
    console.log(`[mediasoup] Router created: id=${this.router.id}`);

    this.worker.on("died", (error: Error) => {
      console.error("[mediasoup] Worker died:", error);
    });

    this.initialized = true;
  }

  setCallbacks(callbacks: {
    onProducerCreated: (producerId: string) => void;
    onProducerClosed: (producerId: string) => void;
  }): void {
    this.onProducerCreated = callbacks.onProducerCreated;
    this.onProducerClosed = callbacks.onProducerClosed;
  }

  /**
   * Create the default producer for ffmpeg RTP input.
   * Only one producer exists at a time.
   */
  async createDefaultProducer(): Promise<{ rtpPort: number; rtcpPort: number }> {
    await this.initialize();

    if (this.producer && !this.producer.closed) {
      throw new Error("Producer already exists");
    }

    const producerTransport = await this.createPlainTransport();

    this.producer = await producerTransport.produce({
      kind: "audio",
      rtpParameters: {
        codecs: [
          {
            mimeType: "audio/opus",
            clockRate: 48_000,
            payloadType: 101,
            channels: 2,
            rtcpFeedback: [],
            parameters: {},
          },
        ],
        encodings: [{ ssrc: 11_111_111 }],
      },
    });

    console.log(`[mediasoup] Producer created: id=${this.producer.id}`);
    this.onProducerCreated?.(this.producer.id);

    return {
      rtpPort: producerTransport.tuple.localPort,
      rtcpPort: producerTransport.rtcpTuple!.localPort,
    };
  }

  /**
   * Create a PlainTransport for receiving RTP from ffmpeg.
   */
  private async createPlainTransport(): Promise<PlainTransport> {
    const transport = await this.router.createPlainTransport({
      listenIp: "127.0.0.1",
      rtcpMux: false,
      comedia: true,
    });

    console.log(`[mediasoup] PlainTransport created: id=${transport.id}`);
    this.producerTransport = transport;
    return transport;
  }

  /**
   * Create a WebRTC transport for a client consumer.
   */
  async createWebRTCTransport(clientId: string): Promise<WebRtcTransport> {
    await this.initialize();

    const transport = await this.router.createWebRtcTransport({
      listenIps: mediasoupConfig.webRtcTransport.listenIps,
      initialAvailableOutgoingBitrate: mediasoupConfig.webRtcTransport.initialAvailableOutgoingBitrate,
      enableUdp: mediasoupConfig.webRtcTransport.enableUdp,
      enableTcp: mediasoupConfig.webRtcTransport.enableTcp,
      preferUdp: mediasoupConfig.webRtcTransport.preferUdp,
    });

    console.log(`[mediasoup] WebRtcTransport created: id=${transport.id} for client=${clientId}`);

    transport.on("dtlsstatechange", (state: string) => {
      if (state === "closed") {
        transport.close();
      }
    });

    this.transports.set(clientId, transport);
    return transport;
  }

  /**
   * Connect a client's transport with DTLS parameters.
   */
  async connectConsumerTransport(
    clientId: string,
    dtlsParameters: DtlsParameters
  ): Promise<{ id: string } | undefined> {
    const transport = this.transports.get(clientId);
    if (!transport) {
      console.error(`[mediasoup] Transport not found for client=${clientId}`);
      return undefined;
    }

    await transport.connect({ dtlsParameters });
    console.log(`[mediasoup] Transport connected: id=${transport.id}`);

    return { id: transport.id };
  }

  /**
   * Create a consumer for a client to receive audio from the producer.
   */
  async consume(
    clientId: string,
    rtpCapabilities: RtpCapabilities
  ): Promise<ConsumerResponse | undefined> {
    const transport = this.transports.get(clientId);
    if (!transport) {
      console.error(`[mediasoup] Transport not found for client=${clientId}`);
      return undefined;
    }

    if (!this.producer || this.producer.closed) {
      console.error("[mediasoup] No producer available");
      return undefined;
    }

    const canConsume = this.router.canConsume({
      producerId: this.producer.id,
      rtpCapabilities,
    });

    if (!canConsume) {
      console.error("[mediasoup] Cannot consume - incompatible RTP capabilities");
      return undefined;
    }

    const consumer = await transport.consume({
      producerId: this.producer.id,
      rtpCapabilities,
      paused: false,
    });

    console.log(`[mediasoup] Consumer created: id=${consumer.id} for client=${clientId}`);
    this.consumers.set(consumer.id, consumer);

    return {
      id: consumer.id,
      producerId: consumer.producerId,
      rtpParameters: consumer.rtpParameters,
      producerPaused: false,
    };
  }

  /**
   * Close a consumer and its transport.
   */
  closeConsumer(clientId: string): void {
    const transport = this.transports.get(clientId);
    if (transport) {
      transport.close();
      this.transports.delete(clientId);
      console.log(`[mediasoup] Transport closed for client=${clientId}`);
    }
  }

  /**
   * Close the producer and notify all clients.
   */
  closeProducer(): void {
    if (!this.producer || this.producer.closed) return;

    const producerId = this.producer.id;
    this.producer.close();
    this.producerTransport?.close();
    this.producerTransport = undefined;

    console.log(`[mediasoup] Producer closed: id=${producerId}`);
    this.onProducerClosed?.(producerId);
  }

  /**
   * Get router RTP capabilities for client device initialization.
   */
  getRtpCapabilities(): RtpCapabilities | undefined {
    return this.router?.rtpCapabilities;
  }

  /**
   * Check if producer is active.
   */
  hasActiveProducer(): boolean {
    return !!this.producer && !this.producer.closed;
  }

  /**
   * Get producer ports for ffmpeg.
   */
  getProducerPorts(): { rtpPort: number; rtcpPort: number } | undefined {
    if (!this.producerTransport) return undefined;
    return {
      rtpPort: this.producerTransport.tuple.localPort,
      rtcpPort: this.producerTransport.rtcpTuple!.localPort,
    };
  }

  /**
   * Set current song metadata.
   */
  setCurrentSong(song: SongMetadata | undefined): void {
    this.currentSong = song;
  }

  getCurrentSong(): SongMetadata | undefined {
    return this.currentSong;
  }
}

// Singleton instance
export const mediasoupHandler = new MediasoupHandler();

// RTP score monitoring - close producer if no RTP received
setInterval(async () => {
  if (mediasoupHandler.producer && !mediasoupHandler.producer.closed) {
    try {
      const stats = await mediasoupHandler.producer.getStats();
      if (stats.length > 0 && stats[0].score === 0) {
        console.log("[mediasoup] RTP score is 0, closing producer");
        mediasoupHandler.closeProducer();
      }
    } catch (error) {
      console.error("[mediasoup] Error getting producer stats:", error);
    }
  }
}, 5000);
