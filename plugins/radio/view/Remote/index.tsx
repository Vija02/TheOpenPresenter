import {
  Button,
  PluginScaffold,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  VolumeBar,
} from "@repo/ui";
import { useState } from "react";
import { FaPause, FaPlay } from "react-icons/fa6";
import "react-scrubber/lib/scrubber.css";

import { usePluginAPI } from "../pluginApi";
import { usePlaylistPosition } from "../usePlaylistPosition";
import { NowPlaying } from "./NowPlaying";
import { PlaylistTab } from "./PlaylistTab";
import { RadioNowPlaying } from "./RadioNowPlaying";
import { RadioTab } from "./RadioTab";
import "./index.css";
import { usePlayerControls } from "./usePlayerControls";

const MusicPlayerRemote = () => {
  const pluginApi = usePluginAPI();
  const mutableRendererData = pluginApi.renderer.useValtioData();

  const radioIsPlaying = pluginApi.renderer.useData((x) => x.isPlaying);
  const radioUrl = pluginApi.renderer.useData((x) => x.url);
  const volume = pluginApi.renderer.useData((x) => x.volume);
  // Selectors only record paths, so anything derived is worked out here
  const tracks = pluginApi.scene.useData((x) => x.pluginData.tracks);
  const { itemId: activeTrackId, isPlaying: trackIsPlaying } =
    usePlaylistPosition();

  const hasTracks = (tracks?.length ?? 0) > 0;

  const controls = usePlayerControls();

  // Scenes from before the playlist existed open on the radio they were using
  const [tab, setTab] = useState(() =>
    !hasTracks && radioUrl ? "radio" : "playlist",
  );

  const isPlaying = radioIsPlaying || trackIsPlaying;
  // Whichever was played last, the radio only once nothing else is loaded
  const showRadio = radioIsPlaying || (!activeTrackId && !!radioUrl);

  return (
    <PluginScaffold
      title="Music Player"
      toolbar={
        <Button
          size="xs"
          variant="pill"
          onClick={controls.togglePlayback}
          disabled={!isPlaying && !radioUrl && !hasTracks}
          aria-label={isPlaying ? "Pause music" : "Play music"}
        >
          {isPlaying ? <FaPause /> : <FaPlay />}
        </Button>
      }
      body={
        <>
          <VolumeBar
            volume={volume}
            onChange={(v) => {
              mutableRendererData.volume = v;
            }}
          />

          <div className="stack-col items-stretch flex-1 p-3 overflow-auto">
            {showRadio ? (
              <RadioNowPlaying controls={controls} />
            ) : (
              <NowPlaying controls={controls} />
            )}

            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="mb-2">
                <TabsTrigger value="playlist">Playlist</TabsTrigger>
                <TabsTrigger value="radio">Radio</TabsTrigger>
              </TabsList>
              <TabsContent value="playlist">
                <PlaylistTab controls={controls} />
              </TabsContent>
              <TabsContent value="radio">
                <RadioTab controls={controls} />
              </TabsContent>
            </Tabs>
          </div>
        </>
      }
    />
  );
};

export default MusicPlayerRemote;
