import type {
  RtpParameters,
  RtpCapabilities,
  DtlsParameters,
  IceCandidate,
  IceParameters,
} from "mediasoup/types";

export interface TrackMetadata {
  id: number;
  source: string;
  source_id: string;
  source_url: string;
  title: string;
  uploader: string | null;
  duration_sec: number | null;
  file_path: string | null;
  requested_by?: string | null;
}

export interface ConsumerResponse {
  id: string;
  producerId: string;
  rtpParameters: RtpParameters;
  producerPaused: boolean;
}

export interface TransportParams {
  id: string;
  iceParameters: IceParameters;
  iceCandidates: IceCandidate[];
  dtlsParameters: DtlsParameters;
}

export type ServerMessage =
  | { type: "welcome"; id: string }
  | { type: "client_count"; count: number }
  | { type: "queue_update"; queue: TrackMetadata[] }
  | { type: "now_playing"; track: TrackMetadata | null }
  | { type: "producer_started"; producerId: string }
  | { type: "producer_closed"; producerId: string }
  | { type: "provider_status"; connected: boolean; ready: boolean; mode: "local" | "external" }
  | { type: "rtp_capabilities"; capabilities: RtpCapabilities }
  | { type: "transport_created"; params: TransportParams }
  | { type: "transport_connected" }
  | { type: "consumed"; params: ConsumerResponse }
  | { type: "error"; message: string };

export type ClientMessage =
  | { type: "get_rtp_capabilities" }
  | { type: "create_transport" }
  | { type: "connect_transport"; dtlsParameters: DtlsParameters }
  | { type: "consume"; rtpCapabilities: RtpCapabilities };

export type ProviderClientMessage =
  | { type: "hello"; token: string }
  | {
      type: "track_info";
      request_id: string;
      source_id: string;
      source_url: string;
      title: string;
      uploader?: string | null;
      duration_sec?: number | null;
    }
  | { type: "upload_start"; source_id: string }
  | { type: "upload_end"; source_id: string }
  | { type: "track_uploaded"; request_id: string; source_id: string }
  | { type: "track_error"; request_id: string; source_id: string; message: string };

export type ProviderServerMessage = {
  type: "request_track";
  request_id: string;
  source_id: string;
  url: string;
};

export type ProviderStatus = {
  type: "provider_status";
  connected: boolean;
  ready: boolean;
  mode: "local" | "external";
};
