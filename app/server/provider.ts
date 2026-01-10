import type { Database } from "bun:sqlite";
import type { FileSink, ServerWebSocket } from "bun";
import type { ProviderClientMessage, ProviderServerMessage, ProviderStatus } from "./types";
import { CACHE_MAX_BYTES, DOWNLOAD_DIR, PROVIDER_MODE, PROVIDER_TOKEN } from "./config";
import {
  removeFromQueueByTrackId,
  updateTrackMetadataBySourceId,
  updateTrackFilePathBySourceId,
  getTrackBySourceId,
  insertTrack,
  getQueue,
} from "./db/queries";
import { refreshQueue } from "./queue";
import { pruneDownloads } from "./cache";
import { mediasoupHandler } from "./mediasoup";
import { join } from "path";

export interface ProviderData {
  role: "provider";
  token?: string;
  connectedAt: number;
}

interface ProviderUploadState {
  sourceId: string;
  filePath: string;
  writer: FileSink;
  bytes: number;
}

let dbRef: Database | null = null;
let providerSocket: ServerWebSocket<ProviderData> | null = null;
let providerReady = false;
const pendingSourceIds = new Set<string>();
const pendingByRequest = new Map<string, string>();
let statusListener: ((status: ProviderStatus) => void) | null = null;
// AIDEV-NOTE: Provider upload is streamed over WebSocket; single in-flight upload to avoid interleaving.
let activeUpload: ProviderUploadState | null = null;

const SOURCE_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

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
    if (activeUpload) {
      void activeUpload.writer.end();
      void Bun.file(activeUpload.filePath).delete();
      activeUpload = null;
    }
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
    case "upload_start": {
      if (!SOURCE_ID_RE.test(message.source_id)) {
        ws.close(4003, "invalid source id");
        return;
      }
      if (activeUpload) {
        ws.close(4100, "upload already in progress");
        return;
      }
      const filePath = join(DOWNLOAD_DIR, `${message.source_id}.mp3`);
      const writer = Bun.file(filePath).writer();
      writer.start({ highWaterMark: 1024 * 1024 });
      activeUpload = {
        sourceId: message.source_id,
        filePath,
        writer,
        bytes: 0,
      };
      return;
    }
    case "upload_end": {
      void finalizeUpload(message.source_id);
      return;
    }
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

export function handleProviderBinaryChunk(
  ws: ServerWebSocket<ProviderData>,
  message: ArrayBuffer | Uint8Array
): void {
  if (!providerReady) return;
  if (!activeUpload) {
    ws.close(4101, "upload not started");
    return;
  }

  const chunk = message instanceof Uint8Array ? message : new Uint8Array(message);
  activeUpload.bytes += activeUpload.writer.write(chunk);
}

async function finalizeUpload(sourceId: string): Promise<void> {
  if (!activeUpload) return;
  if (activeUpload.sourceId !== sourceId) return;

  const upload = activeUpload;
  activeUpload = null;

  await upload.writer.end();

  const file = Bun.file(upload.filePath);
  if (!(await file.exists())) return;
  const size = (await file.stat()).size;
  if (size === 0) {
    await file.delete();
    return;
  }

  updateTrackFileFromUpload(sourceId, upload.filePath);

  if (!dbRef) return;
  const queue = getQueue(dbRef);
  const protectedIds = new Set<string>(queue.map((item) => item.source_id));
  const nowPlaying = mediasoupHandler.getCurrentTrack();
  if (nowPlaying) protectedIds.add(nowPlaying.source_id);
  await pruneDownloads(dbRef, CACHE_MAX_BYTES, protectedIds);
}
