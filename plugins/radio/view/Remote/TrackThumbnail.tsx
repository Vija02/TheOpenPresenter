import { Skeleton, cn } from "@repo/ui";
import { VscMusic } from "react-icons/vsc";

import { Track } from "../../src/types";
import { trackCoverUrl, trackTitle } from "../trackHelpers";

export const TrackThumbnail = ({
  track,
  className,
}: {
  track: Track;
  className?: string;
}) => {
  const coverUrl = trackCoverUrl(track);
  const isAudio = track.type === "audio";

  return (
    <div
      className={cn(
        "aspect-video shrink-0 rounded-sm overflow-hidden",
        isAudio && "bg-gray-800",
        className,
      )}
    >
      {coverUrl ? (
        <img
          src={coverUrl}
          className={cn(
            "w-full h-full",
            isAudio ? "object-contain" : "object-cover",
          )}
          alt={trackTitle(track)}
        />
      ) : isAudio ? (
        <div className="w-full h-full flex items-center justify-center text-gray-400">
          <VscMusic />
        </div>
      ) : (
        <Skeleton className="w-full h-full" />
      )}
    </div>
  );
};
