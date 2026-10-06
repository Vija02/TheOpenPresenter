import { execFile } from "child_process";
import ffmpegPath from "ffmpeg-static";

/** Streaming services' level, so library music sits alongside YouTube tracks */
const LOUDNESS_TARGET = { I: -14, TP: -1, LRA: 11 };

export interface AudioProbe {
  duration?: number;
  codec?: string;
  /** Embedded cover art, which ffmpeg lists as a video stream */
  hasCover: boolean;
  title?: string;
  artist?: string;
  album?: string;
}

export interface LoudnessMeasurement {
  input_i: string;
  input_tp: string;
  input_lra: string;
  input_thresh: string;
  target_offset: string;
}

const runFfmpeg = (args: string[]) =>
  new Promise<string>((resolve) => {
    execFile(
      ffmpegPath!,
      args,
      { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
      // Probing exits with an error since there's no output, so stderr is all we need
      (_err, _stdout, stderr) => resolve(stderr),
    );
  });

/** Reads `ffmpeg -i` output */
export const parseAudioProbe = (stderr: string): AudioProbe | null => {
  const audioMatch = stderr.match(/Stream #\d+:\d+[^:]*: Audio: (\w+)/);
  if (!audioMatch) return null;

  const durationMatch = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  const duration = durationMatch
    ? Number(durationMatch[1]) * 3600 +
      Number(durationMatch[2]) * 60 +
      Number(durationMatch[3])
    : undefined;

  // The file's own tags come before its first Duration line, streams' after
  const inputStart = stderr.indexOf("Input #0");
  const header = stderr.slice(
    Math.max(0, inputStart),
    durationMatch?.index ?? stderr.length,
  );
  const tags: Record<string, string> = {};
  for (const line of header.split("\n")) {
    const match = line.match(/^ {4}(\w+)\s*: (.*)$/);
    if (match) tags[match[1]!.toLowerCase()] = match[2]!.trim();
  }

  return {
    duration,
    codec: audioMatch[1],
    hasCover: /Stream #\d+:\d+[^:]*: Video: /.test(stderr),
    title: tags.title || undefined,
    artist: tags.artist || tags.album_artist || undefined,
    album: tags.album || undefined,
  };
};

export const probeAudio = async (inputPath: string) => {
  const probe = parseAudioProbe(
    await runFfmpeg(["-hide_banner", "-i", inputPath]),
  );
  if (!probe) throw new Error("No audio stream found");
  return probe;
};

export const parseLoudnessMeasurement = (
  stderr: string,
): LoudnessMeasurement | null => {
  const json = stderr.match(/\{[^{}]*"input_i"[^{}]*\}/)?.[0];
  if (!json) return null;
  const measurement = JSON.parse(json) as LoudnessMeasurement;
  // Silence measures as -inf, and there's nothing to even out
  return Number.isFinite(Number(measurement.input_i)) ? measurement : null;
};

/** The first of loudnorm's two passes, so the second can adjust evenly */
export const measureLoudness = async (inputPath: string) => {
  const { I, TP, LRA } = LOUDNESS_TARGET;
  return parseLoudnessMeasurement(
    await runFfmpeg([
      "-hide_banner",
      "-nostats",
      "-i",
      inputPath,
      "-map",
      "0:a:0",
      "-af",
      `loudnorm=I=${I}:TP=${TP}:LRA=${LRA}:print_format=json`,
      "-f",
      "null",
      "-",
    ]),
  );
};

export const loudnormFilter = (measurement: LoudnessMeasurement) => {
  const { I, TP, LRA } = LOUDNESS_TARGET;
  return [
    `loudnorm=I=${I}:TP=${TP}:LRA=${LRA}`,
    `measured_I=${measurement.input_i}`,
    `measured_TP=${measurement.input_tp}`,
    `measured_LRA=${measurement.input_lra}`,
    `measured_thresh=${measurement.input_thresh}`,
    `offset=${measurement.target_offset}`,
    // A steady gain for the whole file, so music doesn't pump
    "linear=true",
  ].join(":");
};

/** Pulls out embedded cover art as a jpg. Check the output exists after */
export const extractCover = async (inputPath: string, outputPath: string) => {
  await runFfmpeg([
    "-hide_banner",
    "-y",
    "-i",
    inputPath,
    "-map",
    "0:v:0",
    "-frames:v",
    "1",
    "-vf",
    "scale='min(600,iw)':-2",
    outputPath,
  ]);
};
