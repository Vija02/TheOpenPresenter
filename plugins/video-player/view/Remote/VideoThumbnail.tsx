import { extractMediaName } from "@repo/lib";
import { MediaPreview, MediaPreviewData, Skeleton, cn } from "@repo/ui";
import { InternalVideo, Video } from "@repo/video";
import { useMemo } from "react";

export const VideoThumbnail = ({ video }: { video: Video }) => {
  const mediaPreviewData: MediaPreviewData | null = useMemo(() => {
    if (!video.isInternalVideo) return null;

    const internalVideo = video as InternalVideo;
    const urlParts = internalVideo.url.split("/");
    const mediaName = urlParts[urlParts.length - 1] ?? "";

    return {
      mediaName,
      fileExtension: extractMediaName(mediaName).extension,
      videoMetadata: {
        thumbnailMediaId: internalVideo.thumbnailMediaName
          ? extractMediaName(internalVideo.thumbnailMediaName).uuid
          : null,
        hlsMediaId: internalVideo.hlsMediaName
          ? extractMediaName(internalVideo.hlsMediaName).uuid
          : null,
      },
    };
  }, [video]);

  const externalThumbnailUrl = useMemo(() => {
    if (video.isInternalVideo) return null;
    return video.metadata.thumbnailUrl ?? null;
  }, [video]);

  return (
    <div className="relative">
      <div
        className={cn(
          "aspect-video w-full md:w-[300px] h-full shrink-0 rounded-lg overflow-hidden",
        )}
      >
        {mediaPreviewData ? (
          <MediaPreview
            media={mediaPreviewData}
            showProcessingOverlay={false}
          />
        ) : externalThumbnailUrl ? (
          <img
            src={externalThumbnailUrl}
            className="w-full h-full object-cover"
            alt={video.metadata.title ?? "Video thumbnail"}
          />
        ) : (
          <Skeleton className="w-full h-full" />
        )}
      </div>
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
