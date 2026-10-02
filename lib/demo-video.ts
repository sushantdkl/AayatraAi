import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

export type VideoFrame = { path: string; durationMs: number; caption: string };

const srtTime = (ms: number) => {
  const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60, r = ms % 1000;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(r).padStart(3, "0")}`;
};

/** ffconcat list: each still is shown for its duration; the last frame is repeated as the concat demuxer requires. */
export function buildConcatList(frames: VideoFrame[]): string {
  if (!frames.length) throw new Error("A demo video needs at least one frame");
  const quote = (path: string) => `'${path.replace(/'/g, "'\\''")}'`;
  const lines = ["ffconcat version 1.0"];
  for (const frame of frames) lines.push(`file ${quote(frame.path)}`, `duration ${(frame.durationMs / 1000).toFixed(3)}`);
  lines.push(`file ${quote(frames[frames.length - 1].path)}`);
  return `${lines.join("\n")}\n`;
}

/** Captions as a sidecar subtitle track (no font dependency, editable, accessible). */
export function buildSubtitles(frames: VideoFrame[]): string {
  let at = 0;
  return frames.map((frame, index) => {
    const start = at; at += frame.durationMs;
    return `${index + 1}\n${srtTime(start)} --> ${srtTime(at)}\n${frame.caption.replace(/\r?\n/g, " ").slice(0, 200)}\n`;
  }).join("\n");
}

export function ffmpegArgs(listPath: string, subtitlesPath: string, outputPath: string): string[] {
  return ["-y", "-hide_banner", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", listPath, "-i", subtitlesPath,
    "-vf", "scale=1280:-2:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=white,format=yuv420p",
    "-r", "30", "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-c:s", "mov_text", "-metadata:s:s:0", "language=eng", "-movflags", "+faststart", outputPath];
}

export async function renderDemoVideo(frames: VideoFrame[], workDir: string, outputPath: string, ffmpeg = process.env.FFMPEG_PATH ?? "ffmpeg"): Promise<{ outputPath: string; subtitlesPath: string; durationMs: number }> {
  const listPath = join(workDir, "frames.ffconcat");
  const subtitlesPath = join(workDir, "captions.srt");
  await writeFile(listPath, buildConcatList(frames));
  await writeFile(subtitlesPath, buildSubtitles(frames));
  await new Promise<void>((resolve, reject) => {
    const child = spawn(ffmpeg, ffmpegArgs(listPath, subtitlesPath, outputPath), { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += String(chunk).slice(0, 2000); });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(0, 500)}`)));
  });
  return { outputPath, subtitlesPath, durationMs: frames.reduce((sum, frame) => sum + frame.durationMs, 0) };
}
