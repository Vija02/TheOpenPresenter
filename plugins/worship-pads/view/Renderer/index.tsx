import { useEffect, useRef, useState } from "react";

import { usePluginAPI } from "../pluginApi";
import { HowlerPlayer } from "./HowlerPlayer";

const WorshipPadsRenderer = () => {
  const pluginApi = usePluginAPI();

  const isPlaying = pluginApi.renderer.useData((x) => x.isPlaying);
  const volume = pluginApi.renderer.useData((x) => x.volume);

  const canPlay = pluginApi.audio.useCanPlay({ skipCheck: !isPlaying });

  const player = useRef<HowlerPlayer>(null);
  const [playerLoaded, setPlayerLoaded] = useState(false);

  useEffect(() => {
    player.current = new HowlerPlayer();
    player.current.targetVolume = volume;
    setPlayerLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!canPlay || !playerLoaded) {
    return null;
  }

  return <Player player={player} />;
};

const FADE_DURATION = 3000;

const Player = ({
  player,
}: {
  player: React.RefObject<HowlerPlayer | null>;
}) => {
  const pluginApi = usePluginAPI();

  const files = pluginApi.scene.useData((x) => x.pluginData.files);

  const currentKey = pluginApi.renderer.useData((x) => x.currentKey);
  const isPlaying = pluginApi.renderer.useData((x) => x.isPlaying);
  const volume = pluginApi.renderer.useData((x) => x.volume);

  useEffect(() => {
    if (isPlaying) {
      // If playing, let's check whether we need to do anything
      const file = files.find((x) => x.key === currentKey)!;
      player.current?.loadTrack(file.key, file.url);

      if (player.current?.currentTrack) {
        // If we're already playing, let's cross fade it
        if (player.current.currentTrack !== currentKey) {
          player.current?.crossFade(
            player.current.currentTrack,
            currentKey,
            FADE_DURATION,
          );
        }
      } else {
        // Otherwise lets just play normally
        player.current?.play(currentKey);
      }
    } else if (player.current?.currentTrack) {
      // If we're not playing, then we should stop
      player.current.stop(player.current.currentTrack, FADE_DURATION);
    }
  }, [currentKey, files, isPlaying, player]);

  // Sync the target volume
  useEffect(() => {
    if (player.current) {
      player.current.targetVolume = volume;
      if (player.current.currentTrack) {
        player.current.setVolume(player.current.currentTrack, volume);
      }
    }
  }, [player, volume]);

  return null;
};

export default WorshipPadsRenderer;
