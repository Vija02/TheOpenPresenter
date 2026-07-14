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
import { UploadedMediaInfo } from "./UploadMediaModal";
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

  const rawFilteredMedia = useMemo(() => {
    const allMedia =
      (data?.organization?.medias.nodes as MediaWithMetadata[]) ?? [];
    return filterMediaByType(allMedia, options?.type ?? "all");
  }, [data, options?.type]);

  const { mediaList: filteredMedia, resetOverrides } = useVideoProcessingStatus(
    rawFilteredMedia,
    { enabled: isOpen },
  );

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
            ) : (
              <div className="flex flex-col gap-2">
                {/* 1. Dropzone Always Top */}
                <Dropzone
                  onUploadComplete={handleUploadComplete}
                  organizationId={organizationId}
                  projectId={projectId}
                  pluginId={pluginId}
                  mediaType={options?.type}
                  multiple={allowMultiple}
                />

                {/* 2. Your Library Section */}
                <div className="flex flex-col gap-3">
                  <h3 className="text-lg font-semibold text-gray-800">
                    Your Library
                  </h3>
                  {isEmpty ? (
                    <div
                      className="flex flex-col items-center justify-center p-10" 
                      data-testid="media-picker-empty-state"
                    >
                      <VscCloudUpload className="size-12 text-gray-400 mb-3" />
                      <h4 className="text-lg font-medium text-gray-700 m-0">
                        No {typeLabel.plural} yet
                      </h4>
                      <p className="text-sm text-gray-500 mt-1">
                        Use the Dropzone above to upload a {typeLabel.singular}.
                      </p>
                    </div>
                  ) : (
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
                  )}
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
      <MediaPreviewDialog
        media={previewMedia}
        isOpen={previewMedia !== null}
        onClose={() => setPreviewMedia(null)}
      />
    </DialogPortalContainerContext.Provider>
  );
};