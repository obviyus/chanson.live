import { DATA_DIR, DOWNLOAD_DIR } from "./config";

export async function ensureDirectories(): Promise<void> {
  await Bun.$`mkdir -p ${DATA_DIR} ${DOWNLOAD_DIR}`;
}
