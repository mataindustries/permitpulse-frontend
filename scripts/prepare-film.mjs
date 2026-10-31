#!/usr/bin/env node
// Places the picture-locked film THE MAPS DISAGREE on the homepage.
//
//   npm run film:prepare -- /path/to/locked-master.mp4 [--poster-at 14.2] [--transcode] [--dist dist]
//   npm run film:prepare -- --disable
//
// The film is never edited: no cuts, grade, scale, frame-rate, or audio
// changes. An H.264/AAC master that already fits Cloudflare Pages' 25 MiB
// per-file limit is remuxed stream-for-stream (only the index moves to the
// front for fast start). Anything else is re-encoded at the same resolution
// and frame rate. A poster frame is extracted, and the homepage switches
// from the drawn title card to the film only after both files verify.

import { execFileSync } from "node:child_process";
import { mkdir, readFile, stat, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PAGES_FILE_LIMIT = 25 * 1024 * 1024;
const FILM_BUDGET = 24 * 1024 * 1024;
const POSTER_BUDGET = 300 * 1024;
const FILM_NAME = "permitpulse-the-maps-disagree.mp4";
const POSTER_NAME = "permitpulse-the-maps-disagree-poster.webp";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);

function option(name) {
  const at = args.indexOf(name);
  return at === -1 ? undefined : args[at + 1];
}

function fail(message) {
  console.error("film:prepare: " + message);
  process.exit(1);
}

function run(binary, params) {
  return execFileSync(binary, params, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function probe(file) {
  const raw = run("ffprobe", ["-v", "error", "-print_format", "json", "-show_streams", "-show_format", file]);
  const data = JSON.parse(raw);
  const video = data.streams.find((stream) => stream.codec_type === "video");
  const audio = data.streams.find((stream) => stream.codec_type === "audio");
  if (!video) fail("no video stream in " + file);
  const [num, den] = String(video.avg_frame_rate || video.r_frame_rate || "0/1").split("/").map(Number);
  return {
    width: video.width,
    height: video.height,
    fps: den ? num / den : 0,
    duration: Number(data.format.duration || video.duration || 0),
    videoCodec: video.codec_name,
    pixFmt: video.pix_fmt,
    audioCodec: audio ? audio.codec_name : null,
    container: data.format.format_name || "",
    bytes: Number(data.format.size || 0)
  };
}

function describe(info) {
  return info.width + "x" + info.height + ", " + info.fps.toFixed(2) + " fps, " + info.duration.toFixed(2) + " s, " +
    info.videoCodec + "/" + (info.audioCodec || "no audio") + ", " + (info.bytes / 1048576).toFixed(1) + " MiB";
}

const distRoot = path.resolve(repoRoot, option("--dist") || "dist");
const homeFile = path.join(distRoot, "index.html");
const filmDir = path.join(distRoot, "assets", "film");
const filmOut = path.join(filmDir, FILM_NAME);
const posterOut = path.join(filmDir, POSTER_NAME);

async function setReady(ready) {
  const html = await readFile(homeFile, "utf8");
  const pattern = /(<figure class="ng-film"[^>]*\sdata-film-ready=")(true|false)(")/;
  if (!pattern.test(html)) fail("could not find the film figure in " + path.relative(repoRoot, homeFile));
  await writeFile(homeFile, html.replace(pattern, "$1" + (ready ? "true" : "false") + "$3"));
}

if (args.includes("--disable")) {
  await setReady(false);
  console.log("Homepage film disabled; the drawn title card shows on its own. Film files were left in place.");
  process.exit(0);
}

const valueFlags = new Set(["--poster-at", "--dist"]);
const positional = [];
for (let i = 0; i < args.length; i += 1) {
  if (valueFlags.has(args[i])) i += 1;
  else if (!args[i].startsWith("--")) positional.push(args[i]);
}
const input = positional[0];
if (!input) fail("pass the path to the locked master, e.g. npm run film:prepare -- ~/Desktop/the-maps-disagree.mp4");
try {
  run("ffprobe", ["-version"]);
  run("ffmpeg", ["-version"]);
} catch {
  fail("ffmpeg and ffprobe are required (https://ffmpeg.org/download.html)");
}

const source = path.resolve(input);
await stat(source).catch(() => fail("file not found: " + source));
const master = probe(source);
console.log("Master:  " + describe(master));

const warnings = [];
if (master.width !== 1080 || master.height !== 1920) warnings.push("expected 1080x1920, got " + master.width + "x" + master.height);
if (Math.abs(master.fps - 60) > 0.5) warnings.push("expected 60 fps, got " + master.fps.toFixed(2));
if (master.duration < 27 || master.duration > 29.5) warnings.push("expected about 28 s, got " + master.duration.toFixed(2) + " s");
if (!master.audioCodec) warnings.push("master has no audio stream; the soundtrack will be missing");
for (const warning of warnings) console.warn("WARNING: " + warning + ". Confirm this is the locked master.");

await mkdir(filmDir, { recursive: true });

const remuxable = !args.includes("--transcode") &&
  master.videoCodec === "h264" && master.pixFmt === "yuv420p" &&
  (master.audioCodec === null || master.audioCodec === "aac") &&
  /mp4|mov/.test(master.container) && master.bytes <= FILM_BUDGET;

const common = ["-y", "-v", "error", "-i", source, "-map", "0:v:0", "-map", "0:a:0?", "-map_metadata", "-1", "-movflags", "+faststart"];
if (remuxable) {
  console.log("Remuxing stream-for-stream (no re-encode).");
  run("ffmpeg", [...common, "-c", "copy", filmOut]);
} else {
  // Same frame size and rate as the master; quality first, then size.
  for (const [crf, maxrate] of [["19", "7M"], ["21", "5.5M"], ["23", "4.5M"]]) {
    console.log("Encoding H.264 at CRF " + crf + " (max " + maxrate + ")...");
    run("ffmpeg", [...common, "-c:v", "libx264", "-preset", "slow", "-crf", crf, "-maxrate", maxrate, "-bufsize", "12M",
      "-profile:v", "high", "-level:v", "4.2", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", filmOut]);
    if ((await stat(filmOut)).size <= FILM_BUDGET) break;
  }
}

const delivered = probe(filmOut);
console.log("Web:     " + describe(delivered));
const problems = [];
if (delivered.bytes > PAGES_FILE_LIMIT) problems.push("film is larger than the 25 MiB Cloudflare Pages file limit");
if (delivered.width !== master.width || delivered.height !== master.height) problems.push("frame size changed");
if (Math.abs(delivered.fps - master.fps) > 0.05) problems.push("frame rate changed");
if (Math.abs(delivered.duration - master.duration) > 0.1) problems.push("duration changed");
if (Boolean(delivered.audioCodec) !== Boolean(master.audioCodec)) problems.push("audio stream lost");
if (problems.length) {
  await rm(filmOut, { force: true });
  fail(problems.join("; ") + ". Nothing was published to the homepage.");
}

const posterAt = Number(option("--poster-at") ?? (master.duration * 0.5).toFixed(2));
if (!Number.isFinite(posterAt) || posterAt < 0 || posterAt > master.duration) fail("--poster-at must be between 0 and " + master.duration.toFixed(2));
run("ffmpeg", ["-y", "-v", "error", "-ss", String(posterAt), "-i", source, "-frames:v", "1", "-vf", "scale=720:-2", "-c:v", "libwebp", "-quality", "82", posterOut]);
const posterBytes = (await stat(posterOut)).size;
console.log("Poster:  frame at " + posterAt + " s, 720 px wide, " + Math.round(posterBytes / 1024) + " KB");
if (posterBytes > POSTER_BUDGET) console.warn("WARNING: poster is over 300 KB; try a calmer frame with --poster-at.");

await setReady(true);
console.log("\nHomepage now shows the film (data-film-ready=\"true\").");
console.log("Next: npm run check, preview the poster frame, then deploy to a preview first.");
