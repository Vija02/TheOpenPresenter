import { isVideoFile, isVideoReady } from "@repo/lib";
import { MediaPreview } from "@repo/ui";
import React from "react";
import { VscPlay } from "react-icons/vsc";

import { MediaWithMetadata } from "./types";

export type MediaCardProps = {
  media: MediaWithMetadata;
  onClick: (e: React.MouseEvent) => void;
  onPreview?: (media: MediaWithMetadata) => void;
  disabled?: boolean;
  selected?: boolean;
};

export const MediaCard: React.FC<MediaCardProps> = ({
  media,
  onClick,
  onPreview,
  disabled,
  selected,
}) => {
  const isVideo = isVideoFile(media.fileExtension);
  const canPreview = isVideo && isVideoReady(media) && !!onPreview;

  return (
    <div
      onClick={disabled ? undefined : (e) => onClick(e)}
      className={`bp--media-card ${disabled ? "bp--media-card--disabled" : ""} ${selected ? "bp--media-card--selected" : ""}`}
    >
      <div className="bp--media-card__preview">
        <MediaPreview media={media} />
        {canPreview && (
          <button
            type="button"
            className="bp--media-card__preview-button"
            onClick={(e) => {
              e.stopPropagation();
              onPreview?.(media);
            }}
            title="Preview"
            data-testid="media-card-preview-button"
          >
            <VscPlay />
          </button>
        )}
      </div>

      <div
        className="bp--media-card__info"
        title={media.originalName ?? media.mediaName}
      >
        {isVideo && <VscPlay className="bp--media-card__icon" />}
        <span className="bp--media-card__name">
          {media.originalName || media.mediaName}
        </span>
      </div>
    </div>
  );
};
