import { Button, Input, Link } from "@repo/ui";
import { useState } from "react";
import { FaPlay, FaStop } from "react-icons/fa6";

import { usePluginAPI } from "../pluginApi";
import { hostnameOf, venueRadios, worshipRadios } from "./radioStations";
import { PlayerControls } from "./usePlayerControls";

const FILTER_THRESHOLD = 8;

export const RadioTab = ({ controls }: { controls: PlayerControls }) => {
  const pluginApi = usePluginAPI();
  const isPlaying = pluginApi.renderer.useData((x) => x.isPlaying);
  const playingUrl = pluginApi.renderer.useData((x) => x.url);

  const [filter, setFilter] = useState("");

  const organizationType = pluginApi.org.organizationType;
  const stations =
    organizationType === "VENUE"
      ? venueRadios
      : organizationType === "CHURCH"
        ? worshipRadios
        : [];

  const visibleStations = stations.filter((x) =>
    x.title.toLowerCase().includes(filter.trim().toLowerCase()),
  );

  return (
    <div className="stack-col items-stretch">
      {stations.length > FILTER_THRESHOLD && (
        <Input
          placeholder="Filter stations..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      )}

      {visibleStations.length === 0 && (
        <div className="text-secondary py-4">No stations found.</div>
      )}

      <div className="stack-col items-stretch gap-1">
        {visibleStations.map((station) => {
          const isActive = station.url === playingUrl;
          const stationIsPlaying = isActive && isPlaying;

          return (
            <div
              key={station.url}
              data-testid="radio-station"
              className={`stack-row p-1 rounded-sm ${isActive ? "bg-gray-100 border border-fill-default" : "border border-transparent"}`}
            >
              <Button
                variant={stationIsPlaying ? "default" : "outline"}
                size="sm"
                // Same width either way, so the row doesn't shift
                className="w-10 shrink-0"
                onClick={() =>
                  stationIsPlaying
                    ? controls.stopRadio()
                    : controls.playRadio(station.url)
                }
                aria-label={`${stationIsPlaying ? "Stop" : "Play"} ${station.title}`}
              >
                {stationIsPlaying ? <FaStop /> : <FaPlay />}
              </Button>
              <div className="flex-1 min-w-0">
                <p className="truncate font-medium">{station.title}</p>
                <Link href={station.webLink} isExternal className="text-xs">
                  {hostnameOf(station.webLink)}
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
