import { Button, Link } from "@repo/ui";
import { FaPlay, FaStop } from "react-icons/fa6";

import { usePluginAPI } from "../pluginApi";
import { StationCover } from "./StationCover";
import { findStation, hostnameOf } from "./radioStations";
import { PlayerControls } from "./usePlayerControls";

export const RadioNowPlaying = ({ controls }: { controls: PlayerControls }) => {
  const pluginApi = usePluginAPI();
  const isPlaying = pluginApi.renderer.useData((x) => x.isPlaying);
  const url = pluginApi.renderer.useData((x) => x.url);

  if (!url) {
    return null;
  }

  const station = findStation(url);
  const title = station?.title ?? hostnameOf(url);

  return (
    <div
      data-testid="now-playing"
      className="stack-row items-center p-2 border border-black/20 rounded-sm shadow-sm"
    >
      <StationCover title={title} isPlaying={isPlaying} className="w-16" />
      <div className="flex-1 min-w-0">
        <p className="stack-row gap-1.5 text-xs uppercase tracking-wide text-secondary">
          {isPlaying ? (
            <>
              <span className="size-2 rounded-full bg-fill-destructive animate-pulse" />
              Live radio
            </>
          ) : (
            "Radio"
          )}
        </p>
        <p className="truncate font-bold">{title}</p>
        {station && (
          <Link href={station.webLink} isExternal className="text-xs">
            {hostnameOf(station.webLink)}
          </Link>
        )}
      </div>
      <Button
        variant={isPlaying ? "default" : "outline"}
        onClick={() =>
          isPlaying ? controls.stopRadio() : controls.playRadio(url)
        }
        aria-label={isPlaying ? "Stop" : "Play"}
      >
        {isPlaying ? <FaStop /> : <FaPlay />}
      </Button>
    </div>
  );
};
