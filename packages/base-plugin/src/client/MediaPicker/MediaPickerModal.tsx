import {
  VideoTranscodeStatus,
  useOrganizationMediaForPickerQuery,
} from "@repo/graphql";
import {
  extractMediaName,
  isHlsFile,
  isImageFile,
  isVideoFile,
  isVideoReady,
  mediaIdFromUUID,
  resolveMediaUrl,
} from "@repo/lib";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { VscCloudUpload } from "react-icons/vsc";

import { MediaPickerOptionsInternal, MediaPickerResult } from "../../types";
import { MediaCard } from "./MediaCard";
import { UploadMediaModal } from "./UploadMediaModal";
import {
  cancelButtonStyle,
  closeButtonStyle,
  emptyStateStyle,
  headerActionsStyle,
  loadingStyle,
  mediaGridStyle,
  modalBackdropStyle,
  modalContainerStyle,
  modalContentStyle,
  modalFooterStyle,
  modalHeaderStyle,
  modalTitleStyle,
  uploadButtonStyle,
} from "./styles";
import { MediaWithMetadata } from "./types";
import { filterMediaByType } from "./utils";

export type MediaPickerModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (result: MediaPickerResult) => void;
  options: MediaPickerOptionsInternal;
};

export const MediaPickerModal: React.FC<MediaPickerModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  options,
}) => {
  const { organizationId, projectId, pluginId } = options.pluginContext;

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [{ data }, refetch] = useOrganizationMediaForPickerQuery({
    variables: {
      organizationId,
      condition: { isUserUploaded: true },
    },
    pause: !isOpen,
  });

  const filteredMedia = useMemo(() => {
    const allMedia =
      (data?.organization?.medias.nodes as MediaWithMetadata[]) ?? [];
    return filterMediaByType(allMedia, options?.type ?? "all");
  }, [data, options?.type]);

  // Check if any videos are still processing
  const hasProcessingVideos = useMemo(() => {
    return filteredMedia.some((media) => {
      if (!isVideoFile(media.fileExtension)) return false;
      const videoMeta = media.videoMetadata;
      if (!videoMeta) return true;
      return (
        videoMeta.transcodeStatus === VideoTranscodeStatus.Pending ||
        videoMeta.transcodeStatus === VideoTranscodeStatus.Processing
      );
    });
  }, [filteredMedia]);

  // Poll for updates when there are processing videos
  useEffect(() => {
    if (!isOpen || !hasProcessingVideos) return;

    const interval = setInterval(() => {
      refetch({ requestPolicy: "network-only" });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, hasProcessingVideos, refetch]);

  const handleSelect = useCallback(
    (media: MediaWithMetadata) => {
      // Don't allow selection of videos that aren't ready
      if (!isVideoReady(media)) return;

      const mediaUrl = resolveMediaUrl(extractMediaName(media.mediaName));

      // Find thumbnail from dependencies (first image dependency)
      let thumbnailUrl: string | undefined;
      let hlsMediaName: string | null = null;
      let duration: number | null = null;

      if (isVideoFile(media.fileExtension)) {
        // Get video metadata (duration, hls, thumbnail from video metadata)
        const videoMeta = media.videoMetadata;
        if (videoMeta) {
          duration =
            typeof videoMeta.duration === "number" ? videoMeta.duration : null;

          // Get HLS from video metadata
          if (videoMeta.hlsMediaId) {
            hlsMediaName = mediaIdFromUUID(videoMeta.hlsMediaId) + ".m3u8";
          }

          // Get thumbnail from video metadata
          if (videoMeta.thumbnailMediaId) {
            const thumbnailMediaName =
              mediaIdFromUUID(videoMeta.thumbnailMediaId) + ".jpg";
            thumbnailUrl = resolveMediaUrl(
              extractMediaName(thumbnailMediaName),
            );
          }
        }

        // Fallback to dependencies if not in metadata
        if (!thumbnailUrl) {
          const imageDependency = media.dependencies.nodes.find((dep) =>
            isImageFile(dep.childMedia?.fileExtension),
          );
          if (imageDependency?.childMedia) {
            thumbnailUrl = resolveMediaUrl(
              extractMediaName(imageDependency.childMedia.mediaName),
            );
          }
        }

        if (!hlsMediaName) {
          const hlsDependency = media.dependencies.nodes.find((dep) =>
            isHlsFile(dep.childMedia?.fileExtension),
          );
          if (hlsDependency?.childMedia) {
            hlsMediaName = hlsDependency.childMedia.mediaName;
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
    <div style={modalBackdropStyle} onClick={onClose}>
      <div style={modalContainerStyle} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={modalHeaderStyle}>
          <h2 style={modalTitleStyle}>{title}</h2>
          <div style={headerActionsStyle}>
            <button
              onClick={() => setIsUploadModalOpen(true)}
              style={uploadButtonStyle}
            >
              <VscCloudUpload />
              Upload
            </button>
            <button onClick={onClose} style={closeButtonStyle}>
              &times;
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={modalContentStyle}>
          {!data && <div style={loadingStyle}>Loading media...</div>}

          {data && filteredMedia.length === 0 && (
            <div style={emptyStateStyle}>
              No media found
              {options?.type && options.type !== "all" && (
                <> of type &quot;{options.type}&quot;</>
              )}
            </div>
          )}

          <div style={mediaGridStyle}>
            {filteredMedia.map((media) => (
              <MediaCard
                key={media.id}
                media={media}
                onClick={() => handleSelect(media)}
                disabled={!isVideoReady(media)}
              />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={modalFooterStyle}>
          <button onClick={onClose} style={cancelButtonStyle}>
            Cancel
          </button>
        </div>
      </div>

      {/* Upload Modal */}
      {isUploadModalOpen && (
        <div onClick={(e) => e.stopPropagation()}>
          <UploadMediaModal
            isOpen={isUploadModalOpen}
            onClose={() => setIsUploadModalOpen(false)}
            onUploadComplete={() => {
              refetch({ requestPolicy: "network-only" });
            }}
            organizationId={organizationId}
            projectId={projectId}
            pluginId={pluginId}
            mediaType={options?.type}
          />
        </div>
      )}
    </div>
  );
};
