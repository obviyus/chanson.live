import type { RtpParameters } from "mediasoup/node/lib/types";

export type SongMetadata = {
	title: string;
	artist: string;
	album: string;
	cover: string;
};

export type ConsumerResponse = {
	id: string;
	producerId: string;
	rtpParameters: RtpParameters;
	producerPaused: boolean;
};
