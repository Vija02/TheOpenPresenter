import { cn } from "@repo/ui";
import { VscMusic } from "react-icons/vsc";

import { Track } from "../../src/types";
import { trackCoverUrl } from "../trackHelpers";

/** A 2x2 grid of the first covers, or the first one when there aren't four */
export const PlaylistCover = ({
  tracks,
  className,
}: {
  tracks: Track[];
  className?: string;
}) => {
  const covers = tracks
    .map(trackCoverUrl)
    .filter((x): x is string => !!x)
    .slice(0, 4);

  return (
    <div
      className={cn(
        "aspect-square shrink-0 rounded-sm overflow-hidden bg-gray-800",
        covers.length === 4 && "grid grid-cols-2",
        className,
      )}
    >
      {covers.length === 0 ? (
        <div className="w-full h-full flex items-center justify-center text-gray-400">
          <VscMusic />
        </div>
      ) : (
        (covers.length === 4 ? covers : covers.slice(0, 1)).map((url, i) => (
          <img
            key={i}
            src={url}
            className="w-full h-full object-cover"
            alt=""
          />
        ))
      )}
    </div>
  );
};
