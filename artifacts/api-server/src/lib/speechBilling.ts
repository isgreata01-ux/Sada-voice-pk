import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function measureMp3DurationSeconds(audio: Buffer): Promise<number> {
  const directory = await mkdtemp(join(tmpdir(), "sada-voice-duration-"));
  const filePath = join(directory, "generated-audio.mp3");

  try {
    await writeFile(filePath, audio, { flag: "wx" });
    const { stdout } = await execFileAsync(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        filePath,
      ],
      { encoding: "utf8", timeout: 15_000, maxBuffer: 64 * 1024 },
    );
    const durationSeconds = Number(stdout.toString().trim());
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
      throw new Error("The generated audio duration was invalid.");
    }
    return durationSeconds;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

export function calculateSpeechTokens(durationSeconds: number): number {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new RangeError("Audio duration must be greater than zero.");
  }
  // 10 tokens per minute, prorated to six-second units and rounded up.
  return Math.ceil(durationSeconds / 6);
}