import { CurrentPlayingVideo } from "../src/types";

export const calculateActualSeek = (
  currentPlayingVideo: CurrentPlayingVideo,
  videoDuration: number,
) => {
  if (!videoDuration) {
    return 0;
  }

  const elapsedSecond =
    (new Date().getTime() - currentPlayingVideo.startedAt) / 1000;
  const startedSecond = currentPlayingVideo.playFrom * videoDuration!;
  const currentSecond = elapsedSecond + startedSecond;

  const finalSeek = Math.min(0.999999, currentSecond / videoDuration);

  return finalSeek;
};
