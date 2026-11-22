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

const probeVideo = JSON.parse(run(ffprobeInstaller.path, [
  "-v", "error",
  "-select_streams", "v:0",
  "-show_entries", "stream=codec_name,width,height,r_frame_rate,avg_frame_rate,duration,nb_frames",
  "-show_entries", "format=duration,size",
  "-of", "json",
  video,
]));

const probeAudio = JSON.parse(run(ffprobeInstaller.path, [
  "-v", "error",
  "-select_streams", "a:0",
  "-show_entries", "stream=codec_name,sample_rate,channels",
  "-of", "json",
  video,
]));

const stream = probeVideo.streams[0];
const audioStream = probeAudio.streams?.[0];
const duration = Number(probeVideo.format.duration);
const size = Number(probeVideo.format.size);

const checks = {
  codec: stream.codec_name === "h264",
  resolution: stream.width === 1920 && stream.height === 1080,
  fps: stream.r_frame_rate === "60/1" && stream.avg_frame_rate === "60/1",
  duration: Math.abs(duration - 36) < 0.1,
  frames: Number(stream.nb_frames) === 2160,
  sizeUnder40MiB: size < 40 * 1024 * 1024,
  audioAac: Boolean(audioStream && audioStream.codec_name === "aac"),
};

if (!Object.values(checks).every(Boolean)) {
  console.error(JSON.stringify({ checks, probeVideo, probeAudio }, null, 2));
  throw new Error("Video metadata verification failed");
}

const timestamps = [3.3, 7.6, 12.6, 17.0, 21.8, 26.4, 29.8, 35.0];
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
  audioCodec: audioStream.codec_name,
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
console.log(`PASS — metadata and ${statSync(video).size < 40 * 1024 * 1024 ? "size" : "size check"} verified; inspect out/contact-sheet.png for visual quality.`);
