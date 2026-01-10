export const NODE_ENV = Bun.env.NODE_ENV ?? "development";

export const PORT = Number.parseInt(Bun.env.PORT ?? "3000", 10);

export const DATA_DIR = Bun.env.DATA_DIR ?? "./data";
export const DOWNLOAD_DIR = Bun.env.DOWNLOAD_DIR ?? "./downloads";
export const DB_PATH = Bun.env.DB_PATH ?? `${DATA_DIR}/chanson.sqlite`;

export const MEDIASOUP_LISTEN_IP = Bun.env.MEDIASOUP_LISTEN_IP ?? "0.0.0.0";
export const MEDIASOUP_ANNOUNCED_IP = Bun.env.MEDIASOUP_ANNOUNCED_IP ?? Bun.env.PUBLIC_IP;

export const RTC_MIN_PORT = Number.parseInt(Bun.env.RTC_MIN_PORT ?? "10000", 10);
export const RTC_MAX_PORT = Number.parseInt(Bun.env.RTC_MAX_PORT ?? "20000", 10);

const configuredStun = (Bun.env.STUN_URLS ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

export const STUN_URLS =
  configuredStun.length > 0
    ? configuredStun
    : ["stun:stun.l.google.com:19302"];
