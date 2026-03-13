import { constructMediaName } from "@repo/lib";
import ffmpegPath from "ffmpeg-static";
import ffprobe from "ffprobe-static";
import ffmpeg from "fluent-ffmpeg";
import { typeidUnboxed } from "typeid-js";

if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
}
ffmpeg.setFfprobePath(ffprobe.path);

export interface VideoMetadata {
  width?: number;
  height?: number;
  duration?: number;
  bitrate?: number;
}

export const extractMetadata = (inputPath: string) => {
  return new Promise<VideoMetadata>((resolve, reject) =>
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) {
        reject(err);
        return;
      }

      const videoStream = metadata.streams.find(
        (stream) => stream.codec_type === "video",
      );
      if (!videoStream) {
        reject(new Error("No video stream found"));
        return;
      }

      resolve({
        width: videoStream.width,
        height: videoStream.height,
        duration: metadata.format.duration,
        bitrate: metadata.format.bit_rate,
      });
    }),
  );
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
