import {
  extractMediaName,
  mediaIdFromUUID,
  resolveMediaUrl,
} from "@repo/lib";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@repo/ui";
import { PreviewVideoPlayer } from "@repo/video/client";
import React, { useMemo } from "react";

import { MediaWithMetadata } from "./types";

export type MediaPreviewDialogProps = {
  media: MediaWithMetadata | null;
  isOpen: boolean;
  onClose: () => void;
};

export const MediaPreviewDialog: React.FC<MediaPreviewDialogProps> = ({
  media,
  isOpen,
  onClose,
}) => {
  const videoUrl = useMemo(() => {
    if (!media) return null;
    const hlsId = media.videoMetadata?.hlsMediaId;
    if (hlsId) {
      const hlsMediaName = mediaIdFromUUID(hlsId) + ".m3u8";
      return resolveMediaUrl(extractMediaName(hlsMediaName));
    }
    return resolveMediaUrl(extractMediaName(media.mediaName));
  }, [media]);

  if (!media || !videoUrl) return null;

  const title = media.originalName ?? media.mediaName;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        size="3xl"
        className="bp--media-preview-dialog"
        data-testid="media-preview-dialog"
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <DialogBody className="bp--media-preview-dialog-body">
          <div className="bp--media-preview-dialog-player">
            <PreviewVideoPlayer src={videoUrl} controls playing />
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
};
