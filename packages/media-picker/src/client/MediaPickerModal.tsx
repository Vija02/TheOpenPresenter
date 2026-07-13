import {
  MediaPickerOptionsInternal,
  MediaPickerResult,
  MediaType,
} from "@repo/base-plugin";
import { useOrganizationMediaForPickerQuery } from "@repo/graphql";
import {
  extractMediaName,
  isImageFile,
  isVideoFile,
  isVideoReady,
  mediaIdFromUUID,
  resolveMediaUrl,
  useVideoProcessingStatus,
} from "@repo/lib";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogPortalContainerContext,
  DialogTitle,
} from "@repo/ui";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { VscCloudUpload } from "react-icons/vsc";
import { typeidUnboxed } from "typeid-js";

import { MediaCard } from "./MediaCard";
import { MediaPreviewDialog } from "./MediaPreviewDialog";
import { UploadMediaModal, UploadedMediaInfo } from "./UploadMediaModal";
import { Dropzone } from "./Dropzone";
import { MediaWithMetadata } from "./types";
import { filterMediaByType } from "./utils";

const TYPE_LABELS: Record<MediaType, { plural: string; singular: string }> = {
  all: { plural: "media", singular: "file" },
  video: { plural: "videos", singular: "video" },
  image: { plural: "images", singular: "image" },
  audio: { plural: "audio files", singular: "audio file" },
  pdf: { plural: "PDFs", singular: "PDF" },
  ppt: { plural: "PowerPoints", singular: "PowerPoint" },
};

export type MediaPickerModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (results: MediaPickerResult[]) => void;
  options: MediaPickerOptionsInternal;
  isPublicAccess?: boolean;
};

export const MediaPickerModal: React.FC<MediaPickerModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  options,
  isPublicAccess = false,
}) => {
  const { organizationId, projectId, pluginId } = options.pluginContext;

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [previewMedia, setPreviewMedia] = useState<MediaWithMetadata | null>(
    null,
  );

  const [{ data }, refetch] = useOrganizationMediaForPickerQuery({
    variables: {
      organizationId,
      condition: { isUserUploaded: true },
    },
    pause: !isOpen || isPublicAccess,
  });

  // Filter media by type
  const rawFilteredMedia = useMemo(() => {
    const allMedia =
      (data?.organization?.medias.nodes as MediaWithMetadata[]) ?? [];
    return filterMediaByType(allMedia, options?.type ?? "all");
  }, [data, options?.type]);

  const { mediaList: filteredMedia, resetOverrides } = useVideoProcessingStatus(
    rawFilteredMedia,
    { enabled: isOpen },
  );

  // Reset selection and overrides when modal closes
  const prevIsOpenRef = useRef(isOpen);
  useEffect(() => {
    if (prevIsOpenRef.current && !isOpen) {
      setSelectedIds(new Set());
      setPreviewMedia(null);
      resetOverrides();
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, resetOverrides]);

  const buildResult = useCallback(
    (media: MediaWithMetadata): MediaPickerResult => {
      const mediaUrl = resolveMediaUrl(extractMediaName(media.mediaName));

      const result: MediaPickerResult = {
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

      return result;
    },
    [],
  );

  const allowMultiple = options?.multiple ?? true;

  const handleClick = useCallback(
    (media: MediaWithMetadata, e: React.MouseEvent) => {
      // Don't allow selection of videos that aren't ready
      if (!isVideoReady(media)) return;

      const isMultiSelect = allowMultiple && e.shiftKey;

      if (isMultiSelect) {
        setSelectedIds((prev) => {
          const newSet = new Set(prev);
          if (newSet.has(media.id)) {
            newSet.delete(media.id);
          } else {
            newSet.add(media.id);
          }
          return newSet;
        });
      } else {
        onSelect([buildResult(media)]);
      }
    },
    [onSelect, buildResult, allowMultiple],
  );

  const handleDone = useCallback(() => {
    const results = filteredMedia
      .filter((media) => selectedIds.has(media.id))
      .map(buildResult);
    onSelect(results);
  }, [filteredMedia, selectedIds, buildResult, onSelect]);

  const buildResultFromUpload = useCallback(
    (mediaName: string, originalName: string | null): MediaPickerResult => {
      const parsed = extractMediaName(mediaName);
      const url = resolveMediaUrl(parsed);
      const result: MediaPickerResult = {
        id: parsed.uuid,
        mediaName,
        originalName,
        fileExtension: parsed.extension,
        url,
      };
      const { extension } = parsed;
      if (isVideoFile(extension)) {
        result.internalVideo = {
          id: typeidUnboxed("video"),
          url,
          isInternalVideo: true,
          hlsMediaName: null,
          thumbnailMediaName: null,
          metadata: {
            title: originalName ?? mediaName,
          },
        };
      }
      return result;
    },
    [],
  );

  const handleUploadComplete = useCallback(
    (uploadedList: UploadedMediaInfo[]) => {
      refetch({ requestPolicy: "network-only" });

      const picked: MediaPickerResult[] = [];
      for (const uploaded of uploadedList) {
        if (!uploaded.mediaName) continue;
        const ext = uploaded.mediaName.split(".").pop() ?? "";
        const isVideoUpload = options?.type === "video" || isVideoFile(ext);
        const allowAutoPick = !isVideoUpload || !!options?.autoPickVideo;
        if (!allowAutoPick) continue;
        picked.push(
          buildResultFromUpload(uploaded.mediaName, uploaded.originalName),
        );
      }

      if (picked.length === 0) return;
      // Respect `multiple: false`
      const finalPicks =
        options?.multiple === false ? picked.slice(0, 1) : picked;
      onSelect(finalPicks);
    },
    [refetch, options, buildResultFromUpload, onSelect],
  );

  const title = options?.title ?? "Select Media";
  const portalContainer = options?.portalContainer;

  const typeLabel = TYPE_LABELS[options?.type ?? "all"];
  const isEmpty = !!data && filteredMedia.length === 0;

  if (!isOpen) return null;

  return (
    <DialogPortalContainerContext.Provider value={portalContainer ?? null}>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent
          size="3xl"
          className="bp--media-picker-dialog"
          data-testid="media-picker-dialog"
        >
          <DialogHeader className="bp--media-picker-header">
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>

          <DialogBody className="bp--media-picker-body">
            {isPublicAccess ? (
              <div
                className="bp--media-picker-empty"
                data-testid="media-picker-public-access-notice"
              >
                <p>Media isn't available when viewing a project publicly.</p>
                <p>Sign in to browse and select media for this project.</p>
              </div>
            ) : !data ? (
              <div className="bp--media-picker-empty">Loading media...</div>
            ) : isEmpty ? (
              <div
                className="bp--media-picker-empty-state"
                data-testid="media-picker-empty-state"
              >
                <VscCloudUpload className="bp--media-picker-empty-state__icon" />
                <h3 className="bp--media-picker-empty-state__title">
                  No {typeLabel.plural} yet
                </h3>
                <p className="bp--media-picker-empty-state__description">
                  Upload a {typeLabel.singular} to get started.
                </p>
                {!isPublicAccess && (
                  <Dropzone
                    onUploadComplete={handleUploadComplete}
                    organizationId={organizationId}
                    projectId={projectId}
                    pluginId={pluginId}
                    mediaType={options?.type}
                    multiple={allowMultiple}
                  />
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {!isPublicAccess && (
                  <Dropzone
                    onUploadComplete={handleUploadComplete}
                    organizationId={organizationId}
                    projectId={projectId}
                    pluginId={pluginId}
                    mediaType={options?.type}
                    multiple={allowMultiple}
                  />
                )}
                <div className="bp--media-picker-grid">
                  {filteredMedia.map((media) => (
                    <MediaCard
                      key={media.id}
                      media={media}
                      onClick={(e) => handleClick(media, e)}
                      onPreview={(m) => setPreviewMedia(m)}
                      disabled={!isVideoReady(media)}
                      selected={selectedIds.has(media.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </DialogBody>

          <DialogFooter className="bp--media-picker-footer">
            {!isPublicAccess && allowMultiple && !isEmpty ? (
              <span className="bp--media-picker-tip">
                Tip: Hold Shift while clicking to select multiple items
              </span>
            ) : (
              <span />
            )}
            <div className="bp--media-picker-footer-buttons">
              <Button variant="outline" onClick={onClose}>
                {isPublicAccess ? "Close" : "Cancel"}
              </Button>
              {!isPublicAccess && selectedIds.size > 0 && (
                <Button onClick={handleDone}>Add ({selectedIds.size})</Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Preview Dialog */}
      <MediaPreviewDialog
        media={previewMedia}
        isOpen={previewMedia !== null}
        onClose={() => setPreviewMedia(null)}
      />
      {/* Upload Modal (Kept for backwards compatibility if triggered elsewhere) */}
      {isUploadModalOpen && (
        <div onClick={(e) => e.stopPropagation()}>
          <UploadMediaModal
            isOpen={isUploadModalOpen}
            onClose={() => setIsUploadModalOpen(false)}
            onUploadComplete={handleUploadComplete}
            organizationId={organizationId}
            projectId={projectId}
            pluginId={pluginId}
            mediaType={options?.type}
            multiple={allowMultiple}
          />
        </div>
      )}
    </DialogPortalContainerContext.Provider>
  );
};