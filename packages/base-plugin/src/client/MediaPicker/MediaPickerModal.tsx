import {
  MediaWithMediaDependencyFragment,
  useOrganizationMediaForPickerQuery,
} from "@repo/graphql";
import {
  SUPPORTED_AUDIO_EXTENSIONS,
  SUPPORTED_IMAGE_EXTENSIONS,
  SUPPORTED_VIDEO_EXTENSIONS,
  extractMediaName,
  mediaIdFromUUID,
  resolveMediaUrl,
} from "@repo/lib";
import React, { useCallback, useMemo, useState } from "react";
import { VscFileMedia, VscPlay } from "react-icons/vsc";

import { MediaPickerOptions, MediaPickerResult, MediaType } from "../../types";

// Extended media type that includes video metadata from the picker query
type MediaWithVideoMetadata = MediaWithMediaDependencyFragment & {
  videoMetadata: {
    nodes: Array<{
      duration: number | null;
      hlsMediaId: string | null;
      thumbnailMediaId: string | null;
    }>;
  };
};

// HLS extension for streaming video
const HLS_EXTENSIONS = [".m3u8"];

const normalizeExtension = (extension: string | null | undefined): string => {
  if (!extension) return "";
  const ext = extension.startsWith(".") ? extension : `.${extension}`;
  return ext.toLowerCase();
};

const isExtensionInList = (
  extension: string | null | undefined,
  list: string[],
): boolean => {
  const ext = normalizeExtension(extension);
  return ext !== "" && list.includes(ext);
};

const isVideoFile = (extension: string | null | undefined): boolean =>
  isExtensionInList(extension, SUPPORTED_VIDEO_EXTENSIONS);

const isImageFile = (extension: string | null | undefined): boolean =>
  isExtensionInList(extension, SUPPORTED_IMAGE_EXTENSIONS);

const isAudioFile = (extension: string | null | undefined): boolean =>
  isExtensionInList(extension, SUPPORTED_AUDIO_EXTENSIONS);

const isHlsFile = (extension: string | null | undefined): boolean =>
  isExtensionInList(extension, HLS_EXTENSIONS);

const filterMediaByType = (
  media: MediaWithVideoMetadata[],
  type: MediaType,
): MediaWithVideoMetadata[] => {
  if (type === "all") return media;

  return media.filter((m) => {
    const ext = m.fileExtension;
    switch (type) {
      case "video":
        return isVideoFile(ext);
      case "image":
        return isImageFile(ext);
      case "audio":
        return isAudioFile(ext);
      default:
        return true;
    }
  });
};

export type MediaPickerModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (result: MediaPickerResult) => void;
  organizationId: string;
  options?: MediaPickerOptions;
};

export const MediaPickerModal: React.FC<MediaPickerModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  organizationId,
  options,
}) => {
  const [{ data, fetching }] = useOrganizationMediaForPickerQuery({
    variables: {
      organizationId,
      condition: { isUserUploaded: true },
    },
    pause: !isOpen,
  });

  const filteredMedia = useMemo(() => {
    const allMedia =
      (data?.organization?.medias.nodes as MediaWithVideoMetadata[]) ?? [];
    return filterMediaByType(allMedia, options?.type ?? "all");
  }, [data, options?.type]);

  const handleSelect = useCallback(
    (media: MediaWithVideoMetadata) => {
      const mediaUrl = resolveMediaUrl(extractMediaName(media.mediaName));

      // Find thumbnail from dependencies (first image dependency)
      let thumbnailUrl: string | undefined;
      let hlsMediaName: string | null = null;
      let duration: number | null = null;

      if (isVideoFile(media.fileExtension)) {
        const imageDependency = media.dependencies.nodes.find((dep) =>
          isImageFile(dep.childMedia?.fileExtension),
        );
        if (imageDependency?.childMedia) {
          thumbnailUrl = resolveMediaUrl(
            extractMediaName(imageDependency.childMedia.mediaName),
          );
        }

        const hlsDependency = media.dependencies.nodes.find((dep) =>
          isHlsFile(dep.childMedia?.fileExtension),
        );
        if (hlsDependency?.childMedia) {
          hlsMediaName = hlsDependency.childMedia.mediaName;
        }

        // Get video metadata (duration, hls, thumbnail from video metadata)
        const videoMeta = media.videoMetadata?.nodes?.[0];
        if (videoMeta) {
          duration =
            typeof videoMeta.duration === "number" ? videoMeta.duration : null;

          // Use HLS from video metadata if not found in dependencies
          if (!hlsMediaName && videoMeta.hlsMediaId) {
            hlsMediaName = mediaIdFromUUID(videoMeta.hlsMediaId) + ".m3u8";
          }

          // Use thumbnail from video metadata if not found in dependencies
          if (!thumbnailUrl && videoMeta.thumbnailMediaId) {
            const thumbnailMediaName =
              mediaIdFromUUID(videoMeta.thumbnailMediaId) + ".jpg";
            thumbnailUrl = resolveMediaUrl(
              extractMediaName(thumbnailMediaName),
            );
          }
        }
      }

      onSelect({
        id: media.id,
        mediaName: media.mediaName,
        originalName: media.originalName,
        fileExtension: media.fileExtension,
        url: mediaUrl,
        thumbnailUrl,
        hlsMediaName,
        duration,
      });
    },
    [onSelect],
  );

  const title = options?.title ?? "Select Media";

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "8px",
          width: "90%",
          maxWidth: "800px",
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #e5e7eb",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 600 }}>
            {title}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: "24px",
              cursor: "pointer",
              padding: "4px",
              lineHeight: 1,
            }}
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <div
          style={{
            padding: "16px",
            overflowY: "auto",
            flex: 1,
          }}
        >
          {fetching && (
            <div style={{ textAlign: "center", padding: "40px" }}>
              Loading media...
            </div>
          )}

          {!fetching && filteredMedia.length === 0 && (
            <div
              style={{ textAlign: "center", padding: "40px", color: "#666" }}
            >
              No media found
              {options?.type && options.type !== "all" && (
                <> of type &quot;{options.type}&quot;</>
              )}
            </div>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
              gap: "12px",
            }}
          >
            {filteredMedia.map((media) => (
              <MediaCard
                key={media.id}
                media={media}
                onClick={() => handleSelect(media)}
              />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "12px 20px",
            borderTop: "1px solid #e5e7eb",
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "8px 16px",
              backgroundColor: "#f3f4f6",
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

// Local MediaCard component with inline styles (base-plugin doesn't have Tailwind)
const MediaCard: React.FC<{
  media: MediaWithVideoMetadata;
  onClick: () => void;
}> = ({ media, onClick }) => {
  const isVideo = isVideoFile(media.fileExtension);
  const isImage = isImageFile(media.fileExtension);

  const mediaUrl = useMemo(
    () => resolveMediaUrl(extractMediaName(media.mediaName)),
    [media.mediaName],
  );

  // Find thumbnail from dependencies or video metadata
  const thumbnailUrl = useMemo(() => {
    if (!isVideo) return null;

    // First try dependencies
    const imageDependency = media.dependencies.nodes.find((dep) =>
      isImageFile(dep.childMedia?.fileExtension),
    );
    if (imageDependency?.childMedia) {
      return resolveMediaUrl(
        extractMediaName(imageDependency.childMedia.mediaName),
      );
    }

    // Fall back to video metadata
    const videoMeta = media.videoMetadata?.nodes?.[0];
    if (videoMeta?.thumbnailMediaId) {
      const thumbnailMediaName =
        mediaIdFromUUID(videoMeta.thumbnailMediaId) + ".jpg";
      return resolveMediaUrl(extractMediaName(thumbnailMediaName));
    }

    return null;
  }, [isVideo, media.dependencies.nodes, media.videoMetadata?.nodes]);

  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        border: isHovered
          ? "1px solid var(--accent)"
          : "1px solid var(--stroke)",
        borderRadius: "6px",
        overflow: "hidden",
        cursor: "pointer",
        backgroundColor: isHovered
          ? "var(--surface-primary-hover)"
          : "var(--surface-primary)",
        transition: "all 0.15s",
      }}
    >
      {/* Preview */}
      <div
        style={{
          aspectRatio: "16/9",
          backgroundColor: "var(--surface-secondary)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {isImage && (
          <img
            src={mediaUrl}
            alt={media.originalName ?? media.mediaName}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        )}
        {isVideo && thumbnailUrl && (
          <img
            src={thumbnailUrl}
            alt={media.originalName ?? media.mediaName}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        )}
        {isVideo && !thumbnailUrl && (
          <VscFileMedia
            style={{ fontSize: "24px", color: "var(--tertiary)" }}
          />
        )}
        {!isImage && !isVideo && (
          <VscFileMedia
            style={{ fontSize: "24px", color: "var(--tertiary)" }}
          />
        )}
      </div>

      {/* Name */}
      <div
        style={{
          padding: "8px",
          fontSize: "12px",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          display: "flex",
          alignItems: "center",
          gap: "4px",
        }}
        title={media.originalName ?? media.mediaName}
      >
        {isVideo && (
          <VscPlay
            style={{
              flexShrink: 0,
              fontSize: "12px",
              color: "var(--secondary)",
            }}
          />
        )}
        <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
          {media.originalName || media.mediaName}
        </span>
      </div>
    </div>
  );
};
