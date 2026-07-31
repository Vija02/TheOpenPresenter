import {
  MediaPickerOptionsInternal,
  MediaPickerResult,
} from "@repo/base-plugin";
import {
  extractMediaName,
  isVideoFile,
  resolveMediaUrl,
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
import React, { useCallback, useRef, useState } from "react";
import { typeidUnboxed } from "typeid-js";

import { Dropzone } from "./Dropzone";
import { UploadedMediaInfo } from "./UploadMediaModal";
import { MediaLibrary, MediaLibraryRef } from "./MediaLibrary";

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
  const libraryRef = useRef<MediaLibraryRef>(null);

  const [selectedCount, setSelectedCount] = useState(0);
  const [isEmpty, setIsEmpty] = useState(false);

  const handleDone = useCallback(() => {
    libraryRef.current?.submitSelection();
  }, []);

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
      libraryRef.current?.refetch();

      const picked: MediaPickerResult[] = [];
      for (const uploaded of uploadedList) {
        if (!uploaded.mediaName) continue;
        const ext = uploaded.mediaName.split(".").pop() ?? "";
        const hasVideoUpload =
          (Array.isArray(options?.type)
            ? options.type.includes("video")
            : options?.type === "video") || isVideoFile(ext);

        const allowAutoPick = !hasVideoUpload || !!options?.autoPickVideo;
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
    [options, buildResultFromUpload, onSelect],
  );

  const title = options?.title ?? "Select Media";
  const portalContainer = options?.portalContainer;
  const allowMultiple = options?.multiple ?? true;

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
            ) : (
              <div className="flex flex-col gap-2">
                <Dropzone
                  onUploadComplete={handleUploadComplete}
                  organizationId={organizationId}
                  projectId={projectId}
                  pluginId={pluginId}
                  mediaType={options?.type}
                  multiple={allowMultiple}
                  overrideAllowedFileTypes={options?.overrideAllowedFileTypes}
                />

                {options?.customComponent && (
                  <div className="py-2">{options.customComponent}</div>
                )}

                <MediaLibrary
                  ref={libraryRef}
                  organizationId={organizationId}
                  type={options?.type}
                  allowMultiple={allowMultiple}
                  isPublicAccess={isPublicAccess}
                  isActive={isOpen}
                  onSelect={onSelect}
                  onSelectionChange={setSelectedCount}
                  onEmptyChange={setIsEmpty}
                  title="Your Library"
                />
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
              {!isPublicAccess && selectedCount > 0 && (
                <Button onClick={handleDone}>Add ({selectedCount})</Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DialogPortalContainerContext.Provider>
  );
};