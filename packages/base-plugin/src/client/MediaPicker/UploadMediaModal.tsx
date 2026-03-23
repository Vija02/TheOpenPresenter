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

import { MediaType } from "../../types";

export type UploadMediaModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete: () => void;
  organizationId: string;
  projectId: string;
  pluginId: string;
  mediaType?: MediaType;
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
}) => {
  const allowedFileTypes = useMemo(
    () => getAllowedFileTypes(mediaType),
    [mediaType],
  );

  const [uppy] = useState(() =>
    new Uppy({
      restrictions: {
        allowedFileTypes,
      },
    }).use(Tus, {
      endpoint: window.location.origin + "/media/upload/tus",
      headers: {
        "csrf-token": appData.getCSRFToken(),
        "organization-id": organizationId,
        "project-id": projectId,
        "plugin-id": pluginId,
      },
      chunkSize: appData.getMediaUploadChunkSize(),
    }),
  );

  // Update restrictions when mediaType changes
  useEffect(() => {
    uppy.setOptions({
      restrictions: {
        allowedFileTypes,
      },
    });
  }, [uppy, allowedFileTypes]);

  useUppyEvent(uppy, "upload-success", () => {
    onUploadComplete();
  });

  useUppyEvent(uppy, "complete", (result) => {
    if (result.successful && result.successful.length > 0) {
      // Clear files after successful upload
      uppy.cancelAll();
      onClose();
    }
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
