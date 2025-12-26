import type {
  RtpParameters,
  RtpCapabilities,
  DtlsParameters,
  IceCandidate,
  IceParameters,
} from "mediasoup/types";

/**
 * Song metadata for display and queue management.
 */
export interface SongMetadata {
  id: number;
  spotify_id: string;
  title: string;
  artist: string;
  album: string;
  cover_url: string;
  duration_ms: number | null;
  file_path: string | null;
  requested_by?: string | null;
  is_automated?: boolean;
}

/**
 * Consumer response sent to clients after creating a consumer.
 */
export interface ConsumerResponse {
  id: string;
  producerId: string;
  rtpParameters: RtpParameters;
  producerPaused: boolean;
}

/**
 * Transport parameters sent to clients for WebRTC connection.
 */
export interface TransportParams {
  id: string;
  iceParameters: IceParameters;
  iceCandidates: IceCandidate[];
  dtlsParameters: DtlsParameters;
}

// WebSocket message types (server → client)
export type ServerMessage =
  | { type: "welcome"; id: string }
  | { type: "client_count"; count: number }
  | { type: "queue_update"; queue: SongMetadata[] }
  | { type: "now_playing"; song: SongMetadata | null }
  | { type: "producer_started"; producerId: string }
  | { type: "producer_closed"; producerId: string }
  | { type: "rtp_capabilities"; capabilities: RtpCapabilities }
  | { type: "transport_created"; params: TransportParams }
  | { type: "transport_connected" }
  | { type: "consumed"; params: ConsumerResponse }
  | { type: "error"; message: string };

// WebSocket message types (client → server)
export type ClientMessage =
  | { type: "get_rtp_capabilities" }
  | { type: "create_transport" }
  | { type: "connect_transport"; dtlsParameters: DtlsParameters }
  | { type: "consume"; rtpCapabilities: RtpCapabilities };
