import { extractMediaName } from "@repo/lib";
import { MediaPreview, MediaPreviewData, Skeleton, cn } from "@repo/ui";
import { InternalVideo, UniversalVideo } from "@repo/video";
import { useMemo } from "react";

export const VideoThumbnail = ({
  video,
  className,
}: {
  video: UniversalVideo;
  className?: string;
}) => {
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
    <div
      className={cn(
        "aspect-video shrink-0 rounded-sm overflow-hidden",
        className,
      )}
    >
      {mediaPreviewData ? (
        <MediaPreview media={mediaPreviewData} showProcessingOverlay={false} />
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
  );
};
