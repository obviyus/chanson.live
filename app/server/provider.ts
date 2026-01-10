import type { Database } from "bun:sqlite";
import type { ServerWebSocket } from "bun";
import type { ProviderClientMessage, ProviderServerMessage, ProviderStatus } from "./types";
import { PROVIDER_MODE, PROVIDER_TOKEN } from "./config";
import {
  removeFromQueueByTrackId,
  updateTrackMetadataBySourceId,
  updateTrackFilePathBySourceId,
  getTrackBySourceId,
  insertTrack,
} from "./db/queries";
import { refreshQueue } from "./queue";

export interface ProviderData {
  role: "provider";
  token?: string;
  connectedAt: number;
}

let dbRef: Database | null = null;
let providerSocket: ServerWebSocket<ProviderData> | null = null;
let providerReady = false;
const pendingSourceIds = new Set<string>();
const pendingByRequest = new Map<string, string>();
let statusListener: ((status: ProviderStatus) => void) | null = null;

export function initProvider(db: Database): void {
  dbRef = db;
}

export function setProviderStatusListener(
  listener: (status: ProviderStatus) => void
): void {
  statusListener = listener;
}

export function getProviderStatus(): ProviderStatus {
  return {
    type: "provider_status",
    connected: Boolean(providerSocket),
    ready: providerReady,
    mode: PROVIDER_MODE === "external" ? "external" : "local",
  };
}

function notifyStatus(): void {
  statusListener?.(getProviderStatus());
}

export function canUseExternalProvider(): boolean {
  return PROVIDER_MODE === "external" && providerReady;
}

export function registerProviderSocket(ws: ServerWebSocket<ProviderData>): void {
  if (providerSocket) {
    ws.close(4090, "provider already connected");
    return;
  }

  providerSocket = ws;
  providerReady = false;
  notifyStatus();
}

export function unregisterProviderSocket(ws: ServerWebSocket<ProviderData>): void {
  if (providerSocket && providerSocket === ws) {
    providerSocket = null;
    providerReady = false;
    pendingSourceIds.clear();
    pendingByRequest.clear();
    notifyStatus();
  }
}

export function handleProviderMessage(
  ws: ServerWebSocket<ProviderData>,
  message: ProviderClientMessage
): void {
  if (PROVIDER_MODE !== "external") {
    ws.close(4002, "provider mode disabled");
    return;
  }

  if (message.type === "hello") {
    if (!PROVIDER_TOKEN || message.token !== PROVIDER_TOKEN) {
      ws.close(4001, "unauthorized");
      return;
    }
    providerReady = true;
    notifyStatus();
    return;
  }

  if (!providerReady) return;
  if (!dbRef) return;

  switch (message.type) {
    case "track_info": {
      const existing = getTrackBySourceId(dbRef, "youtube", message.source_id);
      if (existing) {
        updateTrackMetadataBySourceId(dbRef, "youtube", message.source_id, {
          title: message.title,
          uploader: message.uploader ?? null,
          duration_sec: message.duration_sec ?? null,
          source_url: message.source_url,
        });
      } else {
        insertTrack(dbRef, {
          source: "youtube",
          source_id: message.source_id,
          source_url: message.source_url,
          title: message.title,
          uploader: message.uploader ?? null,
          duration_sec: message.duration_sec ?? null,
          file_path: null,
        });
      }
      refreshQueue(dbRef);
      return;
    }
    case "track_uploaded": {
      pendingSourceIds.delete(message.source_id);
      pendingByRequest.delete(message.request_id);
      return;
    }
    case "track_error": {
      pendingSourceIds.delete(message.source_id);
      pendingByRequest.delete(message.request_id);
      const track = getTrackBySourceId(dbRef, "youtube", message.source_id);
      if (track) {
        removeFromQueueByTrackId(dbRef, track.id);
        refreshQueue(dbRef);
      }
      return;
    }
  }
}

export function requestTrackFromProvider(
  sourceId: string,
  url: string
): boolean {
  if (!providerSocket || !providerReady) return false;
  if (pendingSourceIds.has(sourceId)) return true;

  const requestId = crypto.randomUUID();
  const message: ProviderServerMessage = {
    type: "request_track",
    request_id: requestId,
    source_id: sourceId,
    url,
  };

  pendingSourceIds.add(sourceId);
  pendingByRequest.set(requestId, sourceId);
  providerSocket.send(JSON.stringify(message));
  return true;
}

export function updateTrackFileFromUpload(
  sourceId: string,
  filePath: string
): void {
  if (!dbRef) return;
  updateTrackFilePathBySourceId(dbRef, "youtube", sourceId, filePath);
  refreshQueue(dbRef);
}
