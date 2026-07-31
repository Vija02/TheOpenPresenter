import { MediaPickerResult, MediaType } from "@repo/base-plugin";
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
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react";
import { VscCloudUpload } from "react-icons/vsc";
import { typeidUnboxed } from "typeid-js";

import { MediaCard } from "./MediaCard";
import { MediaPreviewDialog } from "./MediaPreviewDialog";
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

export const buildMediaPickerResult = (
  media: MediaWithMetadata,
): MediaPickerResult => {
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
};

export type MediaLibraryRef = {
  refetch: () => void;
  resetSelection: () => void;
  submitSelection: () => void;
};

export type MediaLibraryProps = {
  organizationId: string;
  type?: MediaType | MediaType[];
  allowMultiple?: boolean;
  isPublicAccess?: boolean;
  isActive?: boolean;
  onSelect: (results: MediaPickerResult[]) => void;
  onSelectionChange?: (selectedCount: number) => void;
  onEmptyChange?: (isEmpty: boolean) => void;
  title?: string | React.ReactNode;
};

export const MediaLibrary = forwardRef<MediaLibraryRef, MediaLibraryProps>(
  (
    {
      organizationId,
      type = "all",
      allowMultiple = true,
      isPublicAccess = false,
      isActive = true,
      onSelect,
      onSelectionChange,
      onEmptyChange,
      title = "Your Library",
    },
    ref,
  ) => {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [previewMedia, setPreviewMedia] = useState<MediaWithMetadata | null>(
      null,
    );

    const [{ data }, refetchQuery] = useOrganizationMediaForPickerQuery({
      variables: {
        organizationId,
        condition: { isUserUploaded: true },
      },
      pause: !isActive || isPublicAccess,
    });

    const rawFilteredMedia = useMemo(() => {
      const allMedia =
        (data?.organization?.medias.nodes as MediaWithMetadata[]) ?? [];
      return filterMediaByType(allMedia, type);
    }, [data, type]);

    const { mediaList: filteredMedia, resetOverrides } = useVideoProcessingStatus(
      rawFilteredMedia,
      { enabled: isActive },
    );

    const prevIsActiveRef = useRef(isActive);
    useEffect(() => {
      if (prevIsActiveRef.current && !isActive) {
        setSelectedIds(new Set());
        setPreviewMedia(null);
        resetOverrides();
        onSelectionChange?.(0);
      }
      prevIsActiveRef.current = isActive;
    }, [isActive, resetOverrides, onSelectionChange]);

    useImperativeHandle(ref, () => ({
      refetch: () => refetchQuery({ requestPolicy: "network-only" }),
      resetSelection: () => {
        setSelectedIds(new Set());
        onSelectionChange?.(0);
      },
      submitSelection: () => {
        const results = filteredMedia
          .filter((media) => selectedIds.has(media.id))
          .map(buildMediaPickerResult);
        onSelect(results);
      },
    }));

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
            onSelectionChange?.(newSet.size);
            return newSet;
          });
        } else {
          onSelect([buildMediaPickerResult(media)]);
        }
      },
      [onSelect, allowMultiple, onSelectionChange],
    );

    const primaryType = (Array.isArray(type) ? type[0] : type) ?? "all";
    const typeLabel = TYPE_LABELS[primaryType] || TYPE_LABELS.all;
    const isEmpty = !!data && filteredMedia.length === 0;

    useEffect(() => {
      onEmptyChange?.(isEmpty);
    }, [isEmpty, onEmptyChange]);

    if (!data && !isPublicAccess) {
      return <div className="bp--media-picker-empty">Loading media...</div>;
    }

    return (
      <div className="flex flex-col gap-3 w-full">
        {title && (
          <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
        )}

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
        <MediaPreviewDialog
          media={previewMedia}
          isOpen={previewMedia !== null}
          onClose={() => setPreviewMedia(null)}
        />
      </div>
    );
  },
);