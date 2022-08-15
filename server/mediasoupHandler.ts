import type {
    Consumer,
    PlainTransport,
    Producer,
    Router,
    RtpCapabilities,
    RtpCodecCapability,
    Transport,
    WebRtcTransport,
    Worker
} from "mediasoup/node/lib/types";
import { io } from "./index";

const mediasoup = require("mediasoup");

const mediasoupOptions = {
    /**
     * Worker options.
     */
    worker: {
        rtcMinPort: 10000,
        rtcMaxPort: 59999,
        logLevel: 'warn',
        logTags: [
            'info',
            'ice',
            'dtls',
            'rtp',
            'srtp',
            'rtcp',
        ]
    },
    /**
     * Router options.
     */
    router: {
        mediaCodecs: [
            {
                kind: 'audio',
                mimeType: 'audio/opus',
                clockRate: 48000,
                channels: 2,
            },
        ] as RtpCodecCapability[],
    },
    /**
     * WebRtcTransport options.
     */
    webRtcTransport: {
        listenIps: [
            {
                ip: '127.0.0.1',
                announcedIp: null,
            }
        ],
        initialAvailableOutgoingBitrate: 1000000,
        initialAvailableIncomingBitrate: 1000000,
        maxIncomingBitrate: 1500000,
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,
    }
}

export class MediasoupWorker {
    worker: Worker;
    router: Router;
    producer: Producer;
    producerTransport: PlainTransport;
    transports: Record<string, Transport> = {};
    consumers: Record<string, Consumer> = {};

    constructor() {
        const start = async () => {
            this.worker = await mediasoup.createWorker();
            this.router = await this.worker.createRouter({ mediaCodecs: mediasoupOptions.router.mediaCodecs });
        }

        start().then(() => {
            console.log(`Worker stared: ${ this.worker.pid }`);
            console.log(`Router started: ${ this.router.id }`);
        });
    }

    /**
     * The server will only ever have a single producer (for now).
     */
    public async createDefaultProducer(): Promise<void> {
        const producerTransport = await this.createPlainTransport();
        this.producer = await producerTransport.produce(
            {
                kind: 'audio',
                rtpParameters:
                    {
                        codecs:
                            [
                                {
                                    mimeType: 'audio/opus',
                                    clockRate: 48000,
                                    payloadType: 101,
                                    channels: 2,
                                    rtcpFeedback: [],
                                    parameters: {}
                                }
                            ],
                        encodings: [{ ssrc: 11111111 }]
                    }
            });

        /**
         * Let all connected clients know there's a new producer in town.
         */
        io.sockets.emit('producerStarted', {
            id: this.producer.id,
        });
    }

    /**
     * WebRTC transports to all connected clients.
     * @param socketID
     */
    public async createWebRTCTransport(socketID: string): Promise<WebRtcTransport> {
        // @ts-ignore
        const transport = await this.router.createWebRtcTransport(mediasoupOptions.webRtcTransport);
        console.log(`new transport created: ${ transport.id }`);

        this.transports[socketID] = transport;
        return transport;
    }

    /**
     * Plain transport to accept RTP packets from a local ffmpeg process.
     */
    public async createPlainTransport(): Promise<PlainTransport> {
        const transport = await this.router.createPlainTransport({
            listenIp: '127.0.0.1',
            rtcpMux: false,
            comedia: true,
        });

        console.log(`NEW_PLAIN_RTP_TRANSPORT: ${ transport.id }`);

        this.producerTransport = transport;
        return transport;
    }

    /**
     * Create a new consumer for our only producer.
     * @param transport
     * @param rtpCapabilities
     */
    public async createConsumer(transport: Transport, rtpCapabilities: RtpCapabilities): Promise<Consumer | null> {
        const canConsume = this.router.canConsume({
            producerId: this.producer.id,
            rtpCapabilities: rtpCapabilities,
        });

        if (!canConsume) {
            console.error(`CANNOT_CONSUME: ${ this.producer.id } WITH ${ rtpCapabilities }`);
            return null;
        }

        const consumer = await transport.consume({
            producerId: this.producer.id,
            rtpCapabilities: rtpCapabilities,
            paused: false,
        });

        console.log(`ADDED_CONSUMER: ${ consumer.id }`);

        this.consumers[consumer.id] = consumer;
        return consumer;
    }
}

export const defaultWorker = new MediasoupWorker();
