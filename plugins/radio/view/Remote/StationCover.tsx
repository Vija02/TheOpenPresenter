import { cn } from "@repo/ui";
import { FaTowerBroadcast } from "react-icons/fa6";

import { Equalizer } from "./Equalizer";

// Stations have no artwork, so each gets its own colour from its name
const hueFor = (title: string) =>
  [...title].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 0) %
  360;

export const StationCover = ({
  title,
  isPlaying,
  className,
}: {
  title: string;
  isPlaying?: boolean;
  className?: string;
}) => {
  const hue = hueFor(title);

  return (
    <div
      className={cn(
        "aspect-square shrink-0 rounded-sm overflow-hidden flex items-center justify-center text-white",
        className,
      )}
      style={{
        background: `linear-gradient(135deg, hsl(${hue} 70% 45%), hsl(${(hue + 40) % 360} 75% 30%))`,
      }}
      aria-hidden
    >
      {isPlaying ? (
        <Equalizer className="h-1/3" />
      ) : (
        <FaTowerBroadcast className="size-2/5 opacity-90" />
      )}
    </div>
  );
};
