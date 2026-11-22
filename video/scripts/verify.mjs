import { spawnSync } from "node:child_process";
import { mkdirSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";

const root = resolve(import.meta.dirname, "..");
const video = resolve(root, "out/open-research-ide-launch.mp4");
const frameDir = resolve(root, "out/frames");
mkdirSync(frameDir, { recursive: true });

const run = (command, args) => {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`${command} failed (${result.status}):\n${result.stderr || result.stdout}`);
  }
  return result.stdout;
};

const probe = JSON.parse(run(ffprobeInstaller.path, [
  "-v", "error",
  "-select_streams", "v:0",
  "-show_entries", "stream=codec_name,width,height,r_frame_rate,avg_frame_rate,duration,nb_frames",
  "-show_entries", "format=duration,size",
  "-of", "json",
  video,
]));
const stream = probe.streams[0];
const duration = Number(probe.format.duration);
const size = Number(probe.format.size);
const checks = {
  codec: stream.codec_name === "h264",
  resolution: stream.width === 1920 && stream.height === 1080,
  fps: stream.r_frame_rate === "30/1" && stream.avg_frame_rate === "30/1",
  duration: Math.abs(duration - 32) < 0.1,
  frames: Number(stream.nb_frames) === 960,
  sizeUnder30MiB: size < 30 * 1024 * 1024,
};
if (!Object.values(checks).every(Boolean)) {
  console.error(JSON.stringify({ checks, probe }, null, 2));
  throw new Error("Video metadata verification failed");
}

const timestamps = [1.7, 5.5, 9.5, 13.5, 17.5, 22, 26.5, 30.5];
const framePaths = timestamps.map((time, index) => {
  const path = resolve(frameDir, `${String(index + 1).padStart(2, "0")}-${time.toFixed(1)}s.png`);
  run(ffmpegInstaller.path, ["-y", "-ss", String(time), "-i", video, "-frames:v", "1", "-update", "1", path]);
  return path;
});
const inputs = framePaths.flatMap((path) => ["-i", path]);
const filters = framePaths.map((_, i) => `[${i}:v]scale=480:270[v${i}]`).join(";");
const stack = `${framePaths.map((_, i) => `[v${i}]`).join("")}xstack=inputs=8:layout=0_0|480_0|960_0|1440_0|0_270|480_270|960_270|1440_270[out]`;
run(ffmpegInstaller.path, [
  "-y", ...inputs,
  "-filter_complex", `${filters};${stack}`,
  "-map", "[out]", "-frames:v", "1", "-update", "1",
  resolve(root, "out/contact-sheet.png"),
]);

const report = {
  status: "PASS",
  file: "out/open-research-ide-launch.mp4",
  codec: stream.codec_name,
  resolution: `${stream.width}x${stream.height}`,
  fps: stream.r_frame_rate,
  durationSeconds: duration,
  frames: Number(stream.nb_frames),
  sizeBytes: size,
  sizeMiB: Number((size / 1024 / 1024).toFixed(2)),
  checks,
  extractedSeconds: timestamps,
  contactSheet: "out/contact-sheet.png",
};
writeFileSync(resolve(root, "out/verification.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
console.log(`PASS — metadata and ${statSync(video).size < 30 * 1024 * 1024 ? "size" : "size check"} verified; inspect out/contact-sheet.png for visual quality.`);
