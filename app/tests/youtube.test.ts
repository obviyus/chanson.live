import { afterAll, expect, test } from "bun:test";
import { chmod, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";


const directory = await mkdtemp(join(tmpdir(), "chanson-youtube-"));
const originalPath = process.env.PATH;
const executable = join(directory, "yt-dlp");
await Bun.write(executable, `#!${process.execPath}
const args = process.argv.slice(2);
if (process.env.CHANSON_TEST_RESULT === "failure") {
  console.error("Download refused");
  process.exit(1);
}
if (args.includes("--dump-json")) {
  console.log(JSON.stringify({ id: "jNQXAC9IVRw", title: "Sample", channel: "Author", duration: 19, live_status: process.env.CHANSON_TEST_RESULT === "live" ? "is_live" : "not_live" }));
} else if (process.env.CHANSON_TEST_RESULT !== "missing") {
  const file = args[args.indexOf("-o") + 1].replace("%(ext)s", "mp3");
  await Bun.write(file, process.env.CHANSON_TEST_RESULT === "empty" ? "" : "audio data");
}
`);
await chmod(executable, 0o700);
afterAll(async () => {
  await rm(directory, { recursive: true });
});

async function invoke(method: "fetchYouTubeInfo" | "downloadYouTubeAudio", args: unknown[], result = "success") {
  const moduleUrl = new URL("../youtube.ts", import.meta.url).href;
  const code = `import { ${method} } from ${JSON.stringify(moduleUrl)}; console.log(JSON.stringify(await ${method}(...${JSON.stringify(args)})));`;
  const proc = Bun.spawn([process.execPath, "--eval", code], {
    env: { ...process.env, PATH: `${directory}:${originalPath}`, CHANSON_TEST_RESULT: result },
    stdout: "pipe", stderr: "pipe",
  });
  const [stdout, stderr] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text()]);
  if (await proc.exited) throw new Error(stderr);
  return JSON.parse(stdout);
}

const url = "https://www.youtube.com/watch?v=jNQXAC9IVRw";

test("metadata keeps channel fallback and rejects live videos", async () => {
  expect(await invoke("fetchYouTubeInfo", [url])).toEqual({
    id: "jNQXAC9IVRw", title: "Sample", uploader: "Author", duration_sec: 19, url,
  });
  await expect(invoke("fetchYouTubeInfo", [url], "live")).rejects.toThrow("Live videos are not supported");
});

test("both download modes produce the requested audio file", async () => {
  for (const retry of [undefined, { attempts: 5, fragments: 10, sleep: "1" }]) {
    const path = await invoke("downloadYouTubeAudio", [url, "success", { directory, quality: "5", retry }]);
    expect(await Bun.file(path).text()).toBe("audio data");
  }
});

test("failed, missing, and empty downloads cannot be reported as complete", async () => {
  for (const [result, message] of [
    ["failure", "Download refused"],
    ["missing", "output file missing"],
    ["empty", "output file was empty"],
  ]) {
    await expect(invoke("downloadYouTubeAudio", [url, result, { directory, quality: "5" }], result)).rejects.toThrow(message);
    expect(await Bun.file(join(directory, `${result}.mp3`)).exists()).toBe(false);
  }
});
