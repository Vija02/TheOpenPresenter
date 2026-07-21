import { MediaType } from "@repo/base-plugin";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@repo/ui";
import React from "react";
import { Dropzone } from "./Dropzone";

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
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="2xl" className="bp--upload-dialog">
        <DialogHeader>
          <DialogTitle>Upload Media</DialogTitle>
        </DialogHeader>
        <DialogBody className="bp--upload-dialog-body">
          <Dropzone
            onUploadComplete={(results) => {
              onUploadComplete(results);
              onClose(); // Automatically close the modal when Dropzone triggers completion
            }}
            organizationId={organizationId}
            projectId={projectId}
            pluginId={pluginId}
            mediaType={mediaType}
            multiple={multiple}
          />
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
};