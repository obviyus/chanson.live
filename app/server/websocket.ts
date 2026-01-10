import type { ServerWebSocket } from "bun";
import type { RtpCapabilities, DtlsParameters } from "mediasoup/types";
import type {
  ServerMessage,
  ClientMessage,
  TrackMetadata,
  ProviderClientMessage,
  ProviderStatus,
} from "./types";
import { mediasoupHandler } from "./mediasoup";
import {
  getProviderStatus,
  handleProviderMessage,
  registerProviderSocket,
  setProviderStatusListener,
  unregisterProviderSocket,
  type ProviderData,
} from "./provider";

/**
 * AIDEV-NOTE: Bun WebSocket handler replacing Socket.io.
 * Uses native Bun WebSocket with JSON message protocol.
 * Each client gets a unique ID stored in ws.data.
 */

interface ClientData {
  role: "client";
  id: string;
  connectedAt: number;
}

// Track all connected clients
const clients = new Map<string, ServerWebSocket<ClientData>>();

// Current queue (will be managed by queue.ts)
let currentQueue: TrackMetadata[] = [];

/**
 * Generate a unique client ID.
 */
function generateClientId(): string {
  return `client_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function createClientData(): ClientData {
  return { role: "client", id: generateClientId(), connectedAt: Date.now() };
}

/**
 * Send a typed message to a single client.
 */
function send(ws: ServerWebSocket<ClientData>, message: ServerMessage): void {
  ws.send(JSON.stringify(message));
}

/**
 * Broadcast a message to all connected clients.
 */
function broadcast(message: ServerMessage): void {
  const data = JSON.stringify(message);
  for (const ws of clients.values()) {
    ws.send(data);
  }
}

function broadcastProviderStatus(status: ProviderStatus): void {
  broadcast(status);
}

/**
 * Broadcast current client count to all clients.
 */
function broadcastClientCount(): void {
  broadcast({ type: "client_count", count: clients.size });
}

/**
 * Broadcast queue update to all clients.
 */
export function broadcastQueue(queue: TrackMetadata[]): void {
  currentQueue = queue;
  broadcast({ type: "queue_update", queue });
}

/**
 * Broadcast now playing update to all clients.
 */
export function broadcastNowPlaying(track: TrackMetadata | null): void {
  broadcast({ type: "now_playing", track });
}

/**
 * Broadcast producer started to all clients.
 */
export function broadcastProducerStarted(producerId: string): void {
  broadcast({ type: "producer_started", producerId });
}

/**
 * Broadcast producer closed to all clients.
 */
export function broadcastProducerClosed(producerId: string): void {
  broadcast({ type: "producer_closed", producerId });
}

/**
 * Get current client count.
 */
export function getClientCount(): number {
  return clients.size;
}

/**
 * Handle incoming WebSocket message from a client.
 */
async function handleMessage(
  ws: ServerWebSocket<ClientData>,
  message: ClientMessage
): Promise<void> {
  const clientId = ws.data.id;

  switch (message.type) {
    case "get_rtp_capabilities": {
      const capabilities = mediasoupHandler.getRtpCapabilities();
      if (capabilities) {
        send(ws, { type: "rtp_capabilities", capabilities });
      } else {
        send(ws, { type: "error", message: "Router not ready" });
      }
      break;
    }

    case "create_transport": {
      try {
        const transport = await mediasoupHandler.createWebRTCTransport(clientId);
        send(ws, {
          type: "transport_created",
          params: {
            id: transport.id,
            iceParameters: transport.iceParameters,
            iceCandidates: transport.iceCandidates,
            dtlsParameters: transport.dtlsParameters,
          },
        });
        // Also send current queue
        send(ws, { type: "queue_update", queue: currentQueue });
      } catch (error) {
        console.error(`[ws] Failed to create transport for ${clientId}:`, error);
        send(ws, { type: "error", message: "Failed to create transport" });
      }
      break;
    }

    case "connect_transport": {
      try {
        const result = await mediasoupHandler.connectConsumerTransport(
          clientId,
          message.dtlsParameters as DtlsParameters
        );
        if (result) {
          send(ws, { type: "transport_connected" });
        } else {
          send(ws, { type: "error", message: "Failed to connect transport" });
        }
      } catch (error) {
        console.error(`[ws] Failed to connect transport for ${clientId}:`, error);
        send(ws, { type: "error", message: "Failed to connect transport" });
      }
      break;
    }

    case "consume": {
      if (!mediasoupHandler.hasActiveProducer()) {
        send(ws, { type: "error", message: "No active producer" });
        break;
      }

      try {
        const result = await mediasoupHandler.consume(
          clientId,
          message.rtpCapabilities as RtpCapabilities
        );
        if (result) {
          send(ws, { type: "consumed", params: result });
        } else {
          send(ws, { type: "error", message: "Failed to consume" });
        }
      } catch (error) {
        console.error(`[ws] Failed to consume for ${clientId}:`, error);
        send(ws, { type: "error", message: "Failed to consume" });
      }
      break;
    }

    default:
      console.warn(`[ws] Unknown message type from ${clientId}`);
  }
}

/**
 * WebSocket handler configuration for Bun.serve.
 */
export const websocketHandler = {
  open(ws: ServerWebSocket<ClientData | ProviderData>) {
    if (ws.data.role === "provider") {
      registerProviderSocket(ws);
      return;
    }

    const clientId = ws.data.id;
    clients.set(clientId, ws);

    console.log(`[ws] Client connected: ${clientId} (total: ${clients.size})`);

    // Send welcome message
    send(ws, { type: "welcome", id: clientId });

    // Broadcast updated client count
    broadcastClientCount();

    // Send current queue
    send(ws, { type: "queue_update", queue: currentQueue });

    // If producer is active, notify client
    if (mediasoupHandler.hasActiveProducer() && mediasoupHandler.producer) {
      send(ws, { type: "producer_started", producerId: mediasoupHandler.producer.id });
    }

    // Send current track if playing
    const currentTrack = mediasoupHandler.getCurrentTrack();
    if (currentTrack) {
      send(ws, { type: "now_playing", track: currentTrack });
    }

    send(ws, getProviderStatus());
  },

  message(ws: ServerWebSocket<ClientData | ProviderData>, message: string | ArrayBuffer | Uint8Array) {
    try {
      const text =
        typeof message === "string" ? message : new TextDecoder().decode(message);
      const parsed = JSON.parse(text);

      if (ws.data.role === "provider") {
        handleProviderMessage(ws, parsed as ProviderClientMessage);
        return;
      }

      handleMessage(ws, parsed as ClientMessage).catch((error) => {
        console.error(`[ws] Error handling message:`, error);
        send(ws, { type: "error", message: "Internal error" });
      });
    } catch (error) {
      console.error(`[ws] Failed to parse message:`, error);
      if (ws.data.role === "client") {
        send(ws, { type: "error", message: "Invalid JSON" });
      }
    }
  },

  close(ws: ServerWebSocket<ClientData | ProviderData>) {
    if (ws.data.role === "provider") {
      unregisterProviderSocket(ws);
      return;
    }

    const clientId = ws.data.id;
    clients.delete(clientId);

    // Clean up mediasoup resources
    mediasoupHandler.closeConsumer(clientId);

    console.log(`[ws] Client disconnected: ${clientId} (total: ${clients.size})`);
    broadcastClientCount();
  },

  error(ws: ServerWebSocket<ClientData | ProviderData>, error: Error) {
    if (ws.data.role === "provider") {
      console.error(`[ws] Provider error:`, error);
      return;
    }
    console.error(`[ws] Error for ${ws.data.id}:`, error);
  },
};

/**
 * Upgrade HTTP request to WebSocket.
 */
export function upgradeToWebSocket(
  req: Request,
  server: ReturnType<typeof Bun.serve>,
  data: ClientData | ProviderData
): Response | undefined {
  const success = server.upgrade(req, {
    data,
  });

  return success ? undefined : new Response("WebSocket upgrade failed", { status: 400 });
}

// Wire up mediasoup callbacks
mediasoupHandler.setCallbacks({
  onProducerCreated: broadcastProducerStarted,
  onProducerClosed: broadcastProducerClosed,
});

setProviderStatusListener(broadcastProviderStatus);
