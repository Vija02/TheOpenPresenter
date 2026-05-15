import { MediaType } from "@repo/base-plugin";
import { appData } from "@repo/lib";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@repo/ui";
import Uppy from "@uppy/core";
import { Dashboard, useUppyEvent } from "@uppy/react";
import Tus from "@uppy/tus";
import React, { useEffect, useMemo, useState } from "react";

export type UploadedMediaInfo = {
  mediaName: string;
  originalName: string | null;
};

export type UploadMediaModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete: (uploaded: UploadedMediaInfo[]) => void;
  organizationId: string;
  projectId?: string;
  pluginId?: string;
  mediaType?: MediaType;
  multiple?: boolean;
};

const getAllowedFileTypes = (mediaType?: MediaType): string[] | undefined => {
  switch (mediaType) {
    case "video":
      return ["video/*"];
    case "image":
      return ["image/*"];
    case "audio":
      return ["audio/*"];
    case "all":
    default:
      return undefined; // Allow all file types
  }
};

export const UploadMediaModal: React.FC<UploadMediaModalProps> = ({
  isOpen,
  onClose,
  onUploadComplete,
  organizationId,
  projectId,
  pluginId,
  mediaType,
  multiple = true,
}) => {
  const allowedFileTypes = useMemo(
    () => getAllowedFileTypes(mediaType),
    [mediaType],
  );
  const maxNumberOfFiles = multiple ? null : 1;

  const [uppy] = useState(() =>
    new Uppy({
      restrictions: {
        allowedFileTypes,
        maxNumberOfFiles,
      },
    }).use(Tus, {
      endpoint: window.location.origin + "/media/upload/tus",
      headers: {
        "csrf-token": appData.getCSRFToken(),
        "organization-id": organizationId,
        ...(projectId ? { "project-id": projectId } : {}),
        ...(pluginId ? { "plugin-id": pluginId } : {}),
      },
      chunkSize: appData.getMediaUploadChunkSize(),
    }),
  );

  // Update restrictions when inputs change
  useEffect(() => {
    uppy.setOptions({
      restrictions: {
        allowedFileTypes,
        maxNumberOfFiles,
      },
    });
  }, [uppy, allowedFileTypes, maxNumberOfFiles]);

  useUppyEvent(uppy, "complete", (result) => {
    if (!result.successful || result.successful.length === 0) return;

    const uploaded: UploadedMediaInfo[] = result.successful.map((file) => {
      const uploadUrl = file?.tus?.uploadUrl ?? "";
      const mediaName = uploadUrl.split("/").pop() ?? "";
      return { mediaName, originalName: file?.name ?? null };
    });

    uppy.cancelAll();
    onUploadComplete(uploaded);
    onClose();
  });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="2xl" className="bp--upload-dialog">
        <DialogHeader>
          <DialogTitle>Upload Media</DialogTitle>
        </DialogHeader>
        <DialogBody className="bp--upload-dialog-body">
          <Dashboard uppy={uppy} proudlyDisplayPoweredByUppy={false} />
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
};
