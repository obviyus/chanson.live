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
} from "mediasoup/node/lib/types";
import type { DtlsParameters } from "mediasoup-client/lib/types";
import type { ConsumerResponse, SongMetadata } from "./types";
import { socketHandler } from "../core.server";

const mediasoup = require("mediasoup");

const mediasoupOptions = {
	/**
	 * Worker options.
	 */
	worker: {
		rtcMinPort: 10_000,
		rtcMaxPort: 59_999,
		logLevel: "warn",
		logTags: ["info", "ice", "dtls", "rtp", "srtp", "rtcp"],
		workerPath:
			"/Users/obviyus/Desktop/radio/node_modules/mediasoup/worker/out/Release/mediasoup-worker",
	},
	/**
	 * Router options.
	 */
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
	/**
	 * WebRtcTransport options.
	 */
	webRtcTransport: {
		listenIps: [
			{
				ip: "127.0.0.1",
				announcedIp: null,
			},
		],
		initialAvailableOutgoingBitrate: 1_000_000,
		initialAvailableIncomingBitrate: 1_000_000,
		maxIncomingBitrate: 1_500_000,
		enableUdp: true,
		enableTcp: true,
		preferUdp: true,
	},
};

export class MediasoupWorker {
	public producer: Producer | undefined;
	private worker!: Worker;
	private router!: Router;
	private producerTransport: PlainTransport | undefined;
	private transports: Record<string, Transport> = {};
	private consumers: Record<string, Consumer> = {};
	private currentSongMetadata: SongMetadata | undefined;

	constructor() {
		this.initializeWorkerAndRouter().catch((error) => {
			console.error(error);
		});
	}

	async initializeWorkerAndRouter() {
		this.worker = await mediasoup.createWorker();
		this.router = await this.worker.createRouter({
			mediaCodecs: mediasoupOptions.router.mediaCodecs,
		});
		console.log(`Worker started: ${this.worker.pid}`);
		console.log(`Router started: ${this.router.id}`);
	}

	/**
	 * The server will only ever have a single producer (for now).
	 */
	public async createDefaultProducer(): Promise<void> {
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

		/**
		 * Let all connected clients know there's a new producer in town.
		 */
		socketHandler.broadcastProducerCreated(this.producer.id);
	}

	/**
	 * Broadcast music metadata to all connected clients.
	 */
	public broadcastMetadata(metadata?: SongMetadata): void {
		if (metadata) {
			this.currentSongMetadata = metadata;
		} else {
			metadata = this.currentSongMetadata;
		}

		this.currentSongMetadata = metadata;
	}

	/**
	 * WebRTC transports to all connected clients.
	 * @param socketID
	 */
	// eslint-disable-next-line @typescript-eslint/naming-convention
	public async createWebRTCTransport(
		socketID: string,
	): Promise<WebRtcTransport> {
		const transport = await this.router.createWebRtcTransport(
			mediasoupOptions.webRtcTransport as any,
		);
		console.log(`new transport created: ${transport.id}`);

		this.transports[socketID] = transport;
		return transport;
	}

	/**
	 * Plain transport to accept RTP packets from a local ffmpeg process.
	 */
	public async createPlainTransport(): Promise<PlainTransport> {
		const transport = await this.router.createPlainTransport({
			listenIp: "127.0.0.1",
			rtcpMux: false,
			comedia: true,
		});

		console.log(`NEW_PLAIN_RTP_TRANSPORT: ${transport.id}`);

		this.producerTransport = transport;
		return transport;
	}

	/**
	 * Close a consumer.
	 */
	public closeConsumer(consumerID: string): void {
		this.consumers[consumerID].close();
		delete this.consumers[consumerID];
		delete this.transports[consumerID];
	}

	/**
	 * Create a new consumer for our only producer.
	 * @param transport
	 * @param rtpCapabilities
	 */
	public async createConsumer(
		transport: Transport,
		rtpCapabilities: RtpCapabilities,
	): Promise<Consumer | undefined> {
		if (!this.producer) {
			return;
		}

		const canConsume = this.router.canConsume({
			producerId: this.producer.id,
			rtpCapabilities,
		});

		if (!canConsume) {
			console.error(
				`CANNOT_CONSUME: ${this.producer.id} WITH ${JSON.stringify(
					rtpCapabilities,
				)}`,
			);
			return;
		}

		const consumer = await transport.consume({
			producerId: this.producer.id,
			rtpCapabilities,
			paused: false,
		});

		console.log(`ADDED_CONSUMER: ${consumer.id}`);

		this.consumers[consumer.id] = consumer;
		return consumer;
	}

	/**
	 * Close the producer.
	 */
	public closeProducer(): void {
		if (!this.producer) {
			return;
		}

		this.producer.close();
		socketHandler.broadcastProducerClosed(this.producer.id);
	}

	/**
	 * Get RTP capabilities of the router.
	 */
	public getRtpCapabilities(): RtpCapabilities | undefined {
		return this.router.rtpCapabilities;
	}

	/**
	 * Connect a consumer transport.
	 */
	public async connectConsumerTransport(
		socketID: string,
		dtlsParameters: DtlsParameters,
	): Promise<Record<string, any> | undefined> {
		const consumerTransport = this.transports[socketID];
		if (consumerTransport) {
			await consumerTransport.connect({
				dtlsParameters,
			});

			return {
				id: consumerTransport.id,
			};
		}

		return;
	}

	/**
	 * Consume a producer.
	 */
	public async consume(
		socketID: string,
		rtpCapabilities: RtpCapabilities,
	): Promise<ConsumerResponse | undefined> {
		const consumerTransport = this.transports[socketID];
		if (!consumerTransport) {
			console.error(`Consumer transport not found: ${socketID}`);
			return;
		}

		const consumer = await this.createConsumer(
			consumerTransport,
			rtpCapabilities,
		);

		if (!consumer) {
			console.error(`Consumer not found: ${socketID}`);
			return;
		}

		return {
			id: consumer.id,
			producerId: consumer.producerId,
			rtpParameters: consumer.rtpParameters,
			producerPaused: false,
		};
	}

	/**
	 * Get producer ports.
	 */
	public getProducerPorts(): Record<string, any> | undefined {
		if (this.producerTransport) {
			return {
				rtpPort: this.producerTransport.tuple.localPort,
				rtcpPort: this.producerTransport.rtcpTuple?.localPort,
			};
		}

		return;
	}
}

const worker = new MediasoupWorker();

setInterval(() => {
	if (worker.producer && !worker.producer.closed) {
		worker.producer
			.getStats()
			.then(async (stats) => {
				/**
				 * Close producer if RTP score is 0. This is just a fallback mechanism if the
				 * ffmpeg process fails to exit gracefully.
				 */
				if (stats.length > 0 && stats[0] && stats[0].score === 0) {
					console.log("RTP score is 0, closing producer");
					worker.closeProducer();
				}
			})
			.catch((error) => {
				console.error(error);
			});
	}
}, 5000);

export default worker;
