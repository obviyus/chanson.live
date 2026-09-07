import { afterAll, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initDatabase } from "../server/db/schema";
import { insertTrack, updateTrackFilePath } from "../server/db/queries";
import { enqueueTrack, getQueueSnapshot, popNextTrack, refreshQueue } from "../server/queue";
import { createClientData, websocketHandler } from "../server/websocket";

const directory = await mkdtemp(join(tmpdir(), "chanson-queue-"));
const db = initDatabase(":memory:");
const audio = join(directory, "sample.mp3");
await Bun.write(audio, "sample");
const pending = insertTrack(db, {
  source: "youtube", source_id: "jNQXAC9IVRw", source_url: "https://youtu.be/jNQXAC9IVRw",
  title: "Pending", uploader: null, duration_sec: null, file_path: null,
});
const ready = insertTrack(db, { ...pending, source_id: "abcdefghijk", title: "Ready", file_path: audio });

const server = Bun.serve<ReturnType<typeof createClientData>>({
  hostname: "127.0.0.1",
  port: 0,
  fetch(req, server) {
    if (server.upgrade(req, { data: createClientData() })) return;
    return new Response("Upgrade required", { status: 400 });
  },
  websocket: websocketHandler,
});
afterAll(async () => {
  server.stop(true);
  db.close();
  await rm(directory, { recursive: true });
});

test("new listeners see the same queue that playback updates", async () => {
  refreshQueue(db);
  enqueueTrack(db, pending, "Listener");
  enqueueTrack(db, ready, null);
  const socket = new WebSocket(`ws://127.0.0.1:${server.port}`);
  const queueMessage = new Promise<unknown>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("No queue sent to listener")), 2000);
    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === "queue_update") {
        clearTimeout(timeout);
        resolve(message.queue);
      }
    };
  });
  try {
    expect(await queueMessage).toEqual(getQueueSnapshot());
    expect(await popNextTrack(db)).toBeNull();
    expect(getQueueSnapshot()).toHaveLength(2);
    updateTrackFilePath(db, pending.id, audio);
    refreshQueue(db);
    expect((await popNextTrack(db))?.requested_by).toBe("Listener");
    expect(getQueueSnapshot().map(track => track.id)).toEqual([ready.id]);
    expect((await popNextTrack(db))?.id).toBe(ready.id);
    expect(getQueueSnapshot()).toEqual([]);
  } finally {
    socket.close();
  }
});
