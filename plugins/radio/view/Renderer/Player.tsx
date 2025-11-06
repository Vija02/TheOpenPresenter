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
    const audioElement = new Audio();
    audioElement.onplaying = () => {
      pluginApi.awareness.setAwarenessStateData({ isLoading: false });
    };
    audioElement.onwaiting = () => {
      pluginApi.awareness.setAwarenessStateData({ isLoading: true });
    };
    const player = new IcecastMetadataPlayer(url!, {
      enableLogging: true,
      onPlay: () => {
        setLocalIsPlaying(true);
      },
      onStop: () => {
        setLocalIsPlaying(false);
      },
      onWarn: (msg) => {
        pluginApi.log.warn({ url, msg }, "Warning on radio playback");
      },
      onError: (msg, err) => {
        pluginApi.log.error({ url, msg, err }, "Error on radio playback");
        pluginApi.awareness.setAwarenessStateData({ isError: true });
      },
      metadataTypes: ["ogg"],
      audioElement,
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
      pluginApi.awareness.setAwarenessStateData({ isLoading: true });
      player?.play();
    } else if (!isPlaying && localIsPlaying) {
      player?.stop();
    }
  }, [isPlaying, localIsPlaying, player, pluginApi.awareness]);

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
