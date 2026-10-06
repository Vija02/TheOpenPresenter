import { Skeleton, cn } from "@repo/ui";

import { Track } from "../../src/types";

export const TrackThumbnail = ({
  track,
  className,
}: {
  track: Track;
  className?: string;
}) => (
  <div
    className={cn(
      "aspect-video shrink-0 rounded-sm overflow-hidden",
      className,
    )}
  >
    {track.metadata.thumbnailUrl ? (
      <img
        src={track.metadata.thumbnailUrl}
        className="w-full h-full object-cover"
        alt={track.metadata.title ?? ""}
      />
    ) : (
      <Skeleton className="w-full h-full" />
    )}
  </div>
);
