import {
  VideoTranscodeStatus,
  useOrganizationMediaForPickerQuery,
} from "@repo/graphql";
import {
  extractMediaName,
  isImageFile,
  isVideoFile,
  isVideoReady,
  mediaIdFromUUID,
  resolveMediaUrl,
} from "@repo/lib";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { VscCloudUpload } from "react-icons/vsc";
import { typeidUnboxed } from "typeid-js";

import { MediaPickerOptionsInternal, MediaPickerResult } from "../../types";
import { MediaCard } from "./MediaCard";
import { UploadMediaModal } from "./UploadMediaModal";
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

      const result: Parameters<typeof onSelect>[0] = {
        id: media.id,
        mediaName: media.mediaName,
        originalName: media.originalName,
        fileExtension: media.fileExtension,
        url: mediaUrl,
      };

      if (isVideoFile(media.fileExtension)) {
        const videoMeta = media.videoMetadata;

        let hlsMediaName: string | null = null;
        let thumbnailMediaName: string | null = null;
        let duration: number | null = null;

        if (videoMeta) {
          if (videoMeta.hlsMediaId) {
            hlsMediaName = mediaIdFromUUID(videoMeta.hlsMediaId) + ".m3u8";
          }
          if (videoMeta.thumbnailMediaId) {
            thumbnailMediaName =
              mediaIdFromUUID(videoMeta.thumbnailMediaId) + ".jpg";
          }
          duration = parseFloat(videoMeta.duration);
        }

        result.internalVideo = {
          id: typeidUnboxed("video"),
          url: result.url,
          isInternalVideo: true,
          hlsMediaName: hlsMediaName,
          thumbnailMediaName: thumbnailMediaName,
          metadata: {
            title: result.originalName ?? result.mediaName,
            ...(thumbnailMediaName
              ? {
                  thumbnailUrl: resolveMediaUrl(
                    extractMediaName(thumbnailMediaName),
                  ),
                }
              : {}),
            ...(duration
              ? {
                  duration,
                }
              : {}),
          },
        };
      }

      // Check for child thumbnail from dependencies (fallback for any media type)
      const imageDependency = media.dependencies.nodes.find((dep) =>
        isImageFile(dep.childMedia?.fileExtension),
      );
      if (imageDependency?.childMedia) {
        result.extraMeta = {
          childThumbnailUrl: resolveMediaUrl(
            extractMediaName(imageDependency.childMedia.mediaName),
          ),
        };
      }

      onSelect(result);
    },
    [onSelect],
  );

  const title = options?.title ?? "Select Media";

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent size="3xl" className="bp--media-picker-dialog">
          <DialogHeader className="bp--media-picker-header">
            <DialogTitle>{title}</DialogTitle>
            <Button onClick={() => setIsUploadModalOpen(true)}>
              <VscCloudUpload />
              Upload
            </Button>
          </DialogHeader>

          <DialogBody className="bp--media-picker-body">
            {!data && (
              <div className="bp--media-picker-empty">Loading media...</div>
            )}

            {data && filteredMedia.length === 0 && (
              <div className="bp--media-picker-empty">
                No media found
                {options?.type && options.type !== "all" && (
                  <> of type &quot;{options.type}&quot;</>
                )}
              </div>
            )}

            <div className="bp--media-picker-grid">
              {filteredMedia.map((media) => (
                <MediaCard
                  key={media.id}
                  media={media}
                  onClick={() => handleSelect(media)}
                  disabled={!isVideoReady(media)}
                />
              ))}
            </div>
          </DialogBody>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
    </>
  );
};
