import ReactPlayer from "react-player";

export const canPlay = (url: string): boolean => {
  return ReactPlayer.canPlay?.(url) ?? false;
};
