import { VideoTranscodeStatus } from "@repo/graphql";
import {
  extractMediaName,
  isAudioFile,
  isBrowserSupportedImageFile,
  isBrowserSupportedVideoFile,
  isExtensionInList,
  isImageFile,
  isVideoFile,
  isVideoReady,
  mediaIdFromUUID,
  resolveMediaUrl,
  resolveProcessedMediaUrl,
} from "@repo/lib";
import React, { useMemo, useState } from "react";
import {
  VscFile,
  VscFileMedia,
  VscLoading,
  VscMusic,
  VscPlay,
} from "react-icons/vsc";

import { cn } from "./lib/utils";

// Generic media type
export type MediaPreviewData = {
  mediaName: string;
  originalName?: string | null;
  fileExtension?: string | null;
  // Video metadata
  videoMetadata?: {
    thumbnailMediaId?: string | null;
    hlsMediaId?: string | null;
    transcodeStatus?: VideoTranscodeStatus | null;
    transcodeProgress?: number | null;
  } | null;
  // Dependencies for fallback thumbnail
  dependencies?: {
    nodes: Array<{
      childMedia?: {
        mediaName: string;
        fileExtension?: string | null;
      } | null;
    }>;
  };
};

export type MediaPreviewProps = {
  media: MediaPreviewData;
  /** Optional video player component - if provided, shows play button and uses this for playback */
  videoPlayerComponent?: React.ComponentType<{
    src: string;
    onEnded?: () => void;
  }>;
  className?: string;
  mediaClassName?: string;
  playButtonClassName?: string;
  iconClassName?: string;
  processedImageSize?: number;
  showProcessingOverlay?: boolean;
};

const isPdfFile = (extension: string | null | undefined): boolean =>
  isExtensionInList(extension, [".pdf"]);

const getFallbackIcon = (
  fileExtension: string | null | undefined,
): React.ComponentType<{ className?: string }> => {
  if (isVideoFile(fileExtension)) return VscFileMedia;
  if (isImageFile(fileExtension)) return VscFileMedia;
  if (isAudioFile(fileExtension)) return VscMusic;
  if (isPdfFile(fileExtension)) return VscFile;
  return VscFileMedia;
};

const getVideoStatusText = (
  videoMetadata: MediaPreviewData["videoMetadata"],
): string | null => {
  if (!videoMetadata) return "Processing...";

  switch (videoMetadata.transcodeStatus) {
    case VideoTranscodeStatus.Pending:
      return "Queued";
    case VideoTranscodeStatus.Processing:
      return `Processing ${videoMetadata.transcodeProgress ?? 0}%`;
    case VideoTranscodeStatus.Failed:
      return "Failed";
    case VideoTranscodeStatus.Completed:
      return null;
    default:
      return null;
  }
};

const ProcessingOverlay: React.FC<{ statusText: string | null }> = ({
  statusText,
}) => (
  <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-1">
    <VscLoading className="text-xl text-white animate-spin" />
    {statusText && (
      <span className="text-[10px] text-white font-medium">{statusText}</span>
    )}
  </div>
);

export const MediaPreview: React.FC<MediaPreviewProps> = ({
  media,
  videoPlayerComponent: VideoPlayer,
  className,
  mediaClassName,
  playButtonClassName,
  iconClassName,
  processedImageSize = 300,
  showProcessingOverlay = true,
}) => {
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  const isBrowserSupportedImage = isBrowserSupportedImageFile(
    media.fileExtension,
  );
  const isBrowserSupportedVideo = isBrowserSupportedVideoFile(
    media.fileExtension,
  );
  const isImage = isImageFile(media.fileExtension);
  const isVideo = isVideoFile(media.fileExtension);

  // Video is processing if it's a video file and not ready
  const isVideoProcessing = isVideo && !isVideoReady(media);
  const videoStatusText = isVideo
    ? getVideoStatusText(media.videoMetadata)
    : null;

  const FallbackIcon = getFallbackIcon(media.fileExtension);

  const mediaUrl = useMemo(
    () => resolveMediaUrl(extractMediaName(media.mediaName)),
    [media.mediaName],
  );

  const processedUrl = useMemo(() => {
    if (!isImage || isBrowserSupportedImage) return null;
    return resolveProcessedMediaUrl({
      mediaUrl: extractMediaName(media.mediaName),
      size: processedImageSize,
    });
  }, [isImage, isBrowserSupportedImage, media.mediaName, processedImageSize]);

  const thumbnailUrl = useMemo(() => {
    // First, check video metadata for thumbnail
    const videoMeta = media.videoMetadata;
    if (videoMeta?.thumbnailMediaId) {
      const thumbnailMediaName =
        mediaIdFromUUID(videoMeta.thumbnailMediaId) + ".jpg";
      return resolveMediaUrl(extractMediaName(thumbnailMediaName));
    }

    // Fallback to dependencies for any image
    const imageDependency = media.dependencies?.nodes.find((dep) =>
      isImageFile(dep.childMedia?.fileExtension),
    );
    if (imageDependency?.childMedia) {
      return resolveMediaUrl(
        extractMediaName(imageDependency.childMedia.mediaName),
      );
    }

    return null;
  }, [media.videoMetadata, media.dependencies?.nodes]);

  const hlsUrl = useMemo(() => {
    if (media.videoMetadata?.hlsMediaId) {
      const hlsMediaName =
        mediaIdFromUUID(media.videoMetadata?.hlsMediaId) + ".m3u8";
      return resolveMediaUrl(extractMediaName(hlsMediaName));
    }
  }, [isBrowserSupportedVideo, media.videoMetadata, media.dependencies?.nodes]);

  const videoUrl = hlsUrl ?? mediaUrl;

  const alt = media.originalName ?? media.mediaName;

  const containerClassName = cn(
    "relative flex items-center justify-center overflow-hidden",
    className,
  );

  const defaultMediaClassName = cn("size-full object-cover", mediaClassName);

  const defaultIconClassName = cn(
    "text-2xl text-[var(--tertiary,#9ca3af)]",
    iconClassName,
  );

  const defaultPlayButtonClassName = cn(
    "absolute inset-0 flex items-center justify-center cursor-pointer bg-transparent border-none p-0",
    playButtonClassName,
  );

  // Case 1: Browser-supported video with player component and currently playing
  if ((hlsUrl || isBrowserSupportedVideo) && VideoPlayer && isVideoPlaying) {
    return (
      <div className={containerClassName}>
        <VideoPlayer src={videoUrl} onEnded={() => setIsVideoPlaying(false)} />
      </div>
    );
  }

  // Case 2: Browser-supported video with player component (show thumbnail + play button)
  if ((hlsUrl || isBrowserSupportedVideo) && VideoPlayer) {
    return (
      <div className={containerClassName}>
        {thumbnailUrl ? (
          <img src={thumbnailUrl} alt={alt} className={defaultMediaClassName} />
        ) : (
          <FallbackIcon className={defaultIconClassName} />
        )}
        {showProcessingOverlay && isVideoProcessing ? (
          <ProcessingOverlay statusText={videoStatusText} />
        ) : (
          <button
            onClick={() => setIsVideoPlaying(true)}
            className={defaultPlayButtonClassName}
            title="Play video"
          >
            <div className="flex items-center justify-center size-12 bg-white/90 rounded-full transition-colors">
              <VscPlay className="text-2xl text-gray-800 ml-0.5" />
            </div>
          </button>
        )}
      </div>
    );
  }

  // Case 3: Video without player (just show thumbnail)
  if (isVideo) {
    return (
      <div className={containerClassName}>
        {thumbnailUrl ? (
          <img src={thumbnailUrl} alt={alt} className={defaultMediaClassName} />
        ) : (
          <FallbackIcon className={defaultIconClassName} />
        )}
        {showProcessingOverlay && isVideoProcessing && (
          <ProcessingOverlay statusText={videoStatusText} />
        )}
      </div>
    );
  }

  // Case 4: Browser-supported image (show directly)
  if (isBrowserSupportedImage) {
    return (
      <div className={containerClassName}>
        <img src={mediaUrl} alt={alt} className={defaultMediaClassName} />
      </div>
    );
  }

  // Case 5: Non-browser-supported image (use processed URL)
  if (isImage && processedUrl) {
    return (
      <div className={containerClassName}>
        <img src={processedUrl} alt={alt} className={defaultMediaClassName} />
      </div>
    );
  }

  // Case 6: Other file types - check for thumbnail from dependencies
  if (thumbnailUrl) {
    return (
      <div className={containerClassName}>
        <img src={thumbnailUrl} alt={alt} className={defaultMediaClassName} />
      </div>
    );
  }

  // Case 7: Fallback - show icon based on file type
  return (
    <div className={containerClassName}>
      <FallbackIcon className={defaultIconClassName} />
    </div>
  );
};

export default MediaPreview;
