import type { Database } from "bun:sqlite";
import type { TrackMetadata } from "./types";
import { addToHistory } from "./db/queries";
import { mediasoupHandler } from "./mediasoup";
import { broadcastNowPlaying } from "./websocket";
import { popNextTrack } from "./queue";

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
      const next = popNextTrack(this.db);
      if (!next) {
        await sleep(500);
        continue;
      }

      await this.playTrack(next);
    }
  }

  private async playTrack(track: TrackMetadata): Promise<void> {
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

    addToHistory(
      this.db,
      track.id,
      track.requested_by ?? null,
      "manual"
    );
  }
}
