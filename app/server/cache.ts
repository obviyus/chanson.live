import type { Database } from "bun:sqlite";
import { DOWNLOAD_DIR } from "./config";
import { updateTrackFilePathBySourceId } from "./db/queries";

interface DownloadEntry {
  sourceId: string;
  path: string;
  size: number;
  mtimeMs: number;
}

export async function pruneDownloads(
  db: Database,
  maxBytes: number,
  protectedSourceIds: Set<string>
): Promise<void> {
  const entries: string[] = [];
  for await (const entry of new Bun.Glob(`${DOWNLOAD_DIR}/*.mp3`).scan()) {
    entries.push(entry);
  }
  const files: DownloadEntry[] = [];
  let total = 0;

  for (const filePath of entries) {
    const filename = filePath.split("/").pop();
    if (!filename) continue;
    const sourceId = filename.replace(/\.mp3$/, "");
    const stat = await Bun.file(filePath).stat();
    const size = stat.size;
    total += size;
    files.push({
      sourceId,
      path: filePath,
      size,
      mtimeMs: stat.mtimeMs,
    });
  }

  if (total <= maxBytes) return;

  files.sort((a, b) => a.mtimeMs - b.mtimeMs);

  for (const file of files) {
    if (total <= maxBytes) break;
    if (protectedSourceIds.has(file.sourceId)) continue;

    await Bun.file(file.path).delete();
    updateTrackFilePathBySourceId(db, "youtube", file.sourceId, null);
    total -= file.size;
  }
}
