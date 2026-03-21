import { isVideoFile } from "@repo/lib";
import { MediaPreview } from "@repo/ui";
import React, { useState } from "react";
import { VscPlay } from "react-icons/vsc";

import {
  getMediaCardStyle,
  mediaNameContainerStyle,
  mediaNameTextStyle,
  mediaPreviewContainerStyle,
  videoIconStyle,
} from "./styles";
import { MediaWithMetadata } from "./types";

export type MediaCardProps = {
  media: MediaWithMetadata;
  onClick: () => void;
  disabled?: boolean;
};

export const MediaCard: React.FC<MediaCardProps> = ({
  media,
  onClick,
  disabled,
}) => {
  const isVideo = isVideoFile(media.fileExtension);

  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={getMediaCardStyle(isHovered, !!disabled)}
    >
      <div style={mediaPreviewContainerStyle}>
        <MediaPreview media={media} />
      </div>

      <div
        style={mediaNameContainerStyle}
        title={media.originalName ?? media.mediaName}
      >
        {isVideo && <VscPlay style={videoIconStyle} />}
        <span style={mediaNameTextStyle}>
          {media.originalName || media.mediaName}
        </span>
      </div>
    </div>
  );
};
