import { VideoTranscodeStatus } from "@repo/graphql";
import {
  extractMediaName,
  isAudioFile,
  isBrowserSupportedImageFile,
  isBrowserSupportedVideoFile,
  isExtensionInList,
  isImageFile,
  isMediaReady,
  isVideoFile,
  mediaIdFromUUID,
  resolveMediaUrl,
  resolveProcessedMediaUrl,
} from "@repo/lib";
import type { UniversalURL } from "@repo/lib";
import React, { useMemo, useState } from "react";
import {
  VscFile,
  VscFileMedia,
  VscLoading,
  VscMusic,
  VscPlay,
} from "react-icons/vsc";

import { UniversalImage } from "../UniversalImage";
import { cn } from "../lib/utils";
import "./MediaPreview.css";

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
  audioMetadata?: {
    coverMediaId?: string | null;
    playbackMedia?: { mediaName: string } | null;
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
  /** Optional video player component - if provided, shows play button and uses this for playback. Audio also gets a play button when this is set */
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
  // Hint for loading a smaller size
  imageWidth?: string;
  loading?: "lazy" | "eager";
};

const isPdfFile = (extension: string | null | undefined): boolean =>
  isExtensionInList(extension, [".pdf"]);

const isPngFile = (extension: string | null | undefined): boolean =>
  isExtensionInList(extension, [".png"]);

const getFallbackIcon = (
  fileExtension: string | null | undefined,
): React.ComponentType<{ className?: string }> => {
  if (isVideoFile(fileExtension)) return VscFileMedia;
  if (isImageFile(fileExtension)) return VscFileMedia;
  if (isAudioFile(fileExtension)) return VscMusic;
  if (isPdfFile(fileExtension)) return VscFile;
  return VscFileMedia;
};

const getProcessingStatusText = (
  metadata:
    | {
        transcodeStatus?: VideoTranscodeStatus | null;
        transcodeProgress?: number | null;
      }
    | null
    | undefined,
): string | null => {
  if (!metadata) return "Processing...";

  switch (metadata.transcodeStatus) {
    case VideoTranscodeStatus.Pending:
      return "Queued";
    case VideoTranscodeStatus.Processing:
      return `Processing ${metadata.transcodeProgress ?? 0}%`;
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
  <div className="ui--media-preview-processing-overlay">
    <VscLoading className="ui--media-preview-processing-spinner" />
    {statusText && (
      <span className="ui--media-preview-processing-text">{statusText}</span>
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
  imageWidth,
  loading,
}) => {
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);

  const isBrowserSupportedImage = isBrowserSupportedImageFile(
    media.fileExtension,
  );
  const isBrowserSupportedVideo = isBrowserSupportedVideoFile(
    media.fileExtension,
  );
  const isImage = isImageFile(media.fileExtension);
  const isVideo = isVideoFile(media.fileExtension);
  const isAudio = isAudioFile(media.fileExtension);
  const isPng = isPngFile(media.fileExtension);

  // Video is processing if it's a video file and not ready
  const isVideoProcessing = isVideo && !isMediaReady(media);
  const videoStatusText = isVideo
    ? getProcessingStatusText(media.videoMetadata)
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
    // First, check video and audio metadata for thumbnail
    const thumbnailMediaId =
      media.videoMetadata?.thumbnailMediaId ??
      media.audioMetadata?.coverMediaId;
    if (thumbnailMediaId) {
      const thumbnailMediaName = mediaIdFromUUID(thumbnailMediaId) + ".jpg";
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
  }, [media.videoMetadata, media.audioMetadata, media.dependencies?.nodes]);

  // The same images as library media, for `UniversalImage` to resize
  const thumbnailSrc = useMemo((): UniversalURL | null => {
    const thumbnailMediaId =
      media.videoMetadata?.thumbnailMediaId ??
      media.audioMetadata?.coverMediaId;
    const mediaName = thumbnailMediaId
      ? mediaIdFromUUID(thumbnailMediaId) + ".jpg"
      : media.dependencies?.nodes.find((dep) =>
          isImageFile(dep.childMedia?.fileExtension),
        )?.childMedia?.mediaName;
    if (!mediaName) return null;
    const { mediaId, extension } = extractMediaName(mediaName);
    return { mediaId, extension };
  }, [media.videoMetadata, media.audioMetadata, media.dependencies?.nodes]);

  const mediaSrc = useMemo((): UniversalURL => {
    const { mediaId, extension } = extractMediaName(media.mediaName);
    return { mediaId, extension };
  }, [media.mediaName]);

  const hlsUrl = useMemo(() => {
    if (media.videoMetadata?.hlsMediaId) {
      const hlsMediaName =
        mediaIdFromUUID(media.videoMetadata?.hlsMediaId) + ".m3u8";
      return resolveMediaUrl(extractMediaName(hlsMediaName));
    }
  }, [isBrowserSupportedVideo, media.videoMetadata, media.dependencies?.nodes]);

  const videoUrl = hlsUrl ?? mediaUrl;

  const audioPlaybackMediaName = media.audioMetadata?.playbackMedia?.mediaName;
  const audioPlaybackUrl = useMemo(
    () =>
      audioPlaybackMediaName
        ? resolveMediaUrl(extractMediaName(audioPlaybackMediaName))
        : null,
    [audioPlaybackMediaName],
  );

  const alt = media.originalName ?? media.mediaName;

  const containerClassName = cn("ui--media-preview-container", className);

  const defaultMediaClassName = cn("ui--media-preview-media", mediaClassName);

  const defaultIconClassName = cn("ui--media-preview-icon", iconClassName);

  /** Resized to `imageWidth` where it's library media, else as it is */
  const still = (url: string, src: UniversalURL | null) =>
    imageWidth && src ? (
      <UniversalImage
        src={src}
        width={imageWidth}
        fallback={<FallbackIcon className={defaultIconClassName} />}
        imgProp={{ alt, className: defaultMediaClassName, loading }}
      />
    ) : (
      <img
        loading={loading}
        src={url}
        alt={alt}
        className={defaultMediaClassName}
      />
    );

  const defaultPlayButtonClassName = cn(
    "ui--media-preview-play-button",
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
          still(thumbnailUrl, thumbnailSrc)
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
            <div className="ui--media-preview-play-icon-wrapper">
              <VscPlay className="ui--media-preview-play-icon" />
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
          still(thumbnailUrl, thumbnailSrc)
        ) : (
          <FallbackIcon className={defaultIconClassName} />
        )}
        {showProcessingOverlay && isVideoProcessing && (
          <ProcessingOverlay statusText={videoStatusText} />
        )}
      </div>
    );
  }

  // Case 4: Audio (cover art, playing the processed file once it's ready)
  if (isAudio) {
    const isAudioReady = isMediaReady(media) && !!audioPlaybackUrl;
    return (
      <div className={containerClassName}>
        {thumbnailUrl ? (
          still(thumbnailUrl, thumbnailSrc)
        ) : (
          <FallbackIcon className={defaultIconClassName} />
        )}
        {showProcessingOverlay && !isMediaReady(media) ? (
          <ProcessingOverlay
            statusText={getProcessingStatusText(media.audioMetadata)}
          />
        ) : VideoPlayer && isAudioReady && isAudioPlaying ? (
          <audio
            src={audioPlaybackUrl}
            controls
            autoPlay
            onEnded={() => setIsAudioPlaying(false)}
            className="ui--media-preview-audio"
          />
        ) : VideoPlayer && isAudioReady ? (
          <button
            onClick={() => setIsAudioPlaying(true)}
            className={defaultPlayButtonClassName}
            title="Play audio"
          >
            <div className="ui--media-preview-play-icon-wrapper">
              <VscPlay className="ui--media-preview-play-icon" />
            </div>
          </button>
        ) : null}
      </div>
    );
  }

  // Case 5: Browser-supported image (show directly)
  if (isBrowserSupportedImage) {
    return (
      <div
        className={cn(
          isPng && "ui--media-preview-checkerboard",
          containerClassName,
        )}
      >
        {still(mediaUrl, mediaSrc)}
      </div>
    );
  }

  // Case 6: Non-browser-supported image (use processed URL)
  if (isImage && processedUrl) {
    return (
      <div className={containerClassName}>
        <img
          loading={loading}
          src={processedUrl}
          alt={alt}
          className={defaultMediaClassName}
        />
      </div>
    );
  }

  // Case 7: Other file types - check for thumbnail from dependencies
  if (thumbnailUrl) {
    return (
      <div className={containerClassName}>
        {still(thumbnailUrl, thumbnailSrc)}
      </div>
    );
  }

  // Case 8: Fallback - show icon based on file type
  return (
    <div className={containerClassName}>
      <FallbackIcon className={defaultIconClassName} />
    </div>
  );
};

export default MediaPreview;
