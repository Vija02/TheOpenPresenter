import { constructMediaName } from "@repo/lib";
import { execFile } from "child_process";
import ffmpegPath from "ffmpeg-static";
import ffmpeg from "fluent-ffmpeg";
import { typeidUnboxed } from "typeid-js";

if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
}

export interface VideoMetadata {
  width?: number;
  height?: number;
  duration?: number;
  bitrate?: number;
}

export const extractMetadata = (inputPath: string): Promise<VideoMetadata> => {
  return new Promise((resolve, reject) => {
    // ffmpeg -i with no output prints stream info to stderr then exits with code 1
    execFile(
      ffmpegPath!,
      ["-i", inputPath],
      { encoding: "utf8" },
      (_err, _stdout, stderr) => {
        // \d{2,} avoids matching the 1-digit "0" in hex codec IDs like 0x31637661
        const videoMatch = stderr.match(/Stream.*?Video:.*?(\d{2,})x(\d{2,})/);
        if (!videoMatch) {
          reject(new Error("No video stream found"));
          return;
        }

        const durationMatch = stderr.match(
          /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/,
        );
        const bitrateMatch = stderr.match(/bitrate:\s*(\d+)\s*kb\/s/);

        let duration: number | undefined;
        if (durationMatch) {
          const [, h, m, s] = durationMatch;
          if (h && m) {
            duration = parseInt(h) * 3600 + parseInt(m) * 60 + parseFloat(s);
          }
        }
        console.log({
          width: parseInt(videoMatch[1] ?? ""),
          height: parseInt(videoMatch[2] ?? ""),
          duration,
          bitrate: bitrateMatch
            ? parseInt(bitrateMatch[1] ?? "") * 1000
            : undefined,
        });

        resolve({
          width: parseInt(videoMatch[1] ?? ""),
          height: parseInt(videoMatch[2] ?? ""),
          duration,
          bitrate: bitrateMatch
            ? parseInt(bitrateMatch[1] ?? "") * 1000
            : undefined,
        });
      },
    );
  });
};

export const generateThumbnail = ({
  inputPath,
  folder,
}: {
  inputPath: string;
  folder: string;
}) => {
  const mediaId = typeidUnboxed("media");
  const mediaName = constructMediaName(mediaId, "jpg");

  return new Promise<{ mediaId: string; mediaName: string }>(
    (resolve, reject) => {
      ffmpeg(inputPath)
        .screenshot({
          timestamps: ["50%"],
          folder,
          filename: mediaName,
          size: "360x?",
        })
        .on("end", () => {
          resolve({ mediaId, mediaName });
        })
        .on("error", (err) => {
          reject(err);
        });
    },
  );
};
