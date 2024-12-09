import { perceptualToAmplitude } from "@discordapp/perceptual";
import IcecastMetadataPlayer from "icecast-metadata-player";
import { useEffect, useState } from "react";
import { useDisposable } from "use-disposable";

import { usePluginAPI } from "../pluginApi";

const Player = () => {
  const pluginApi = usePluginAPI();

  const isPlaying = pluginApi.renderer.useData((x) => x.isPlaying);
  const volume = pluginApi.renderer.useData((x) => x.volume);
  const url = pluginApi.renderer.useData((x) => x.url!);

  const [localIsPlaying, setLocalIsPlaying] = useState(false);

  const player = useDisposable(() => {
    const player = new IcecastMetadataPlayer(url!, {
      onPlay: () => {
        setLocalIsPlaying(true);
      },
      onStop: () => {
        setLocalIsPlaying(false);
      },
      metadataTypes: ["ogg"],
    });
    return [
      player,
      () => {
        player.detachAudioElement();
      },
    ];
  }, []);

  useEffect(() => {
    if (isPlaying && !localIsPlaying) {
      player?.play();
    } else if (!isPlaying && localIsPlaying) {
      player?.stop();
    }
  }, [isPlaying, localIsPlaying, player]);

  useEffect(() => {
    if (player) {
      player.audioElement.volume = perceptualToAmplitude(
        Math.min(Math.max(0, volume ?? 1), 1),
      );
    }
  }, [player, volume]);

  return null;
};

export default Player;
