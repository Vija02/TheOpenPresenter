import { extractMediaName } from "@repo/lib";
import { Skeleton, cn } from "@repo/ui";
import { useMemo } from "react";

import { InternalVideo, Video } from "../../src";
import { usePluginAPI } from "../pluginApi";

export const VideoThumbnail = ({ video }: { video: Video }) => {
  const pluginApi = usePluginAPI();

  const url = useMemo(() => {
    if (video.isInternalVideo && (video as InternalVideo).thumbnailMediaName) {
      return pluginApi.media.resolveMediaUrl(
        extractMediaName((video as InternalVideo).thumbnailMediaName!),
      );
    }
    if (video.metadata.thumbnailUrl) {
      return video.metadata.thumbnailUrl;
    }
    return null;
  }, [pluginApi.media, video]);

  return (
    <div className="relative">
      {url ? (
        <img
          src={url}
          className={cn(
            "aspect-video w-full md:w-[300px] h-full shrink-0 rounded-lg",
          )}
        />
      ) : (
        <Skeleton
          className={cn(
            "aspect-video w-full md:w-[300px] h-full shrink-0 rounded-lg",
          )}
        />
      )}
      {video.metadata.duration !== undefined && (
        <div className="absolute bottom-2 right-2 bg-gray-900 opacity-90 text-white rounded-sm px-1 text-xs font-bold">
          {formatDuration(video.metadata.duration)}
        </div>
      )}
    </div>
  );
};

function formatDuration(seconds: number) {
  const timeStr = new Date(seconds * 1000).toISOString().slice(11, 19);
  return timeStr.startsWith("00:") ? timeStr.slice(3) : timeStr;
}
