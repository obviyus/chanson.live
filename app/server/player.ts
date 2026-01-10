import type { Database } from "bun:sqlite";
import type { TrackMetadata } from "./types";
import { addToHistory, getTrackBySourceId } from "./db/queries";
import { mediasoupHandler } from "./mediasoup";
import { broadcastNowPlaying } from "./websocket";
import { hasQueuedTracks, popNextTrack } from "./queue";
import { DOWNLOAD_DIR } from "./config";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * AIDEV-NOTE: Single-threaded playback loop. If concurrency or
 * multi-producer is needed later, split into a dedicated scheduler.
 */
export class Player {
  private db: Database;
  private running = false;
  private currentTrack: TrackMetadata | null = null;
  private currentProc: ReturnType<typeof Bun.spawn> | null = null;
  private cachePlaylist = new CachePlaylist();

  constructor(db: Database) {
    this.db = db;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    void this.loop();
  }

  stop(): void {
    this.running = false;
    this.skip();
  }

  skip(): void {
    if (this.currentProc) {
      this.currentProc.kill();
    }
  }

  getNowPlaying(): TrackMetadata | null {
    return this.currentTrack;
  }

  private async loop(): Promise<void> {
    await mediasoupHandler.initialize();

    while (this.running) {
      const next = await popNextTrack(this.db);
      if (!next) {
        if (hasQueuedTracks()) {
          await sleep(500);
          continue;
        }

        const fallback = await this.getFallbackTrack();
        if (fallback) {
          await this.playTrack(fallback, "fallback");
          continue;
        }

        await sleep(500);
        continue;
      }

      await this.playTrack(next);
    }
  }

  private async playTrack(track: TrackMetadata, historySource = "manual"): Promise<void> {
    if (!track.file_path) {
      console.error("[player] Track missing file_path", track.id);
      return;
    }

    if (!(await Bun.file(track.file_path).exists())) {
      console.error("[player] Track file missing", track.file_path);
      return;
    }

    if (mediasoupHandler.hasActiveProducer()) {
      mediasoupHandler.closeProducer();
    }

    const { rtpPort, rtcpPort } = await mediasoupHandler.createDefaultProducer();

    this.currentTrack = track;
    mediasoupHandler.setCurrentTrack(track);
    broadcastNowPlaying(track);

    const ffmpegArgs = [
      "ffmpeg",
      "-nostats",
      "-loglevel",
      "warning",
      "-re",
      "-i",
      track.file_path,
      "-vn",
      "-map",
      "0:a",
      "-c:a",
      "libopus",
      "-ar",
      "48000",
      "-ac",
      "2",
      "-ssrc",
      "11111111",
      "-payload_type",
      "101",
      "-f",
      "rtp",
      `rtp://127.0.0.1:${rtpPort}?rtcpport=${rtcpPort}`,
    ];

    const proc = Bun.spawn(ffmpegArgs, {
      stdout: "inherit",
      stderr: "inherit",
    });

    this.currentProc = proc;
    const exitCode = await proc.exited;

    this.currentProc = null;
    this.currentTrack = null;
    mediasoupHandler.setCurrentTrack(undefined);
    broadcastNowPlaying(null);
    mediasoupHandler.closeProducer();

    if (exitCode !== 0) {
      console.error(`[player] ffmpeg exited with code ${exitCode}`);
    }

    addToHistory(this.db, track.id, track.requested_by ?? null, historySource);
  }

  private async getFallbackTrack(): Promise<TrackMetadata | null> {
    const available = await this.cachePlaylist.ensure();
    if (available === 0) return null;

    let attempts = available;
    while (attempts > 0) {
      attempts -= 1;
      const sourceId = this.cachePlaylist.take();
      if (!sourceId) return null;

      const track = getTrackBySourceId(this.db, "youtube", sourceId);
      if (!track || !track.file_path) continue;
      if (!(await Bun.file(track.file_path).exists())) continue;

      return {
        id: track.id,
        source: track.source,
        source_id: track.source_id,
        source_url: track.source_url,
        title: track.title,
        uploader: track.uploader,
        duration_sec: track.duration_sec,
        file_path: track.file_path,
        requested_by: null,
      };
    }

    return null;
  }
}

class CachePlaylist {
  // AIDEV-NOTE: Fallback playback uses a shuffle bag of cached mp3s only when queue is empty.
  private bag: string[] = [];

  async ensure(): Promise<number> {
    if (this.bag.length > 0) return this.bag.length;
    await this.refill();
    return this.bag.length;
  }

  take(): string | null {
    return this.bag.shift() ?? null;
  }

  private async refill(): Promise<void> {
    const ids: string[] = [];
    for await (const entry of new Bun.Glob(`${DOWNLOAD_DIR}/*.mp3`).scan()) {
      const filename = entry.split("/").pop();
      if (!filename) continue;
      const id = filename.replace(/\.mp3$/, "");
      if (id) ids.push(id);
    }

    shuffle(ids);
    this.bag = ids;
  }
}

function shuffle(values: string[]): void {
  for (let i = values.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [values[i], values[j]] = [values[j], values[i]];
  }
}
