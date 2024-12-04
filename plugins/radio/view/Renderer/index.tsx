import { useEffect, useRef, useState } from "react";

import { usePluginAPI } from "../pluginApi";

// TODO: Different sources
// const link1 = "https://s3.radio.co/sd16d576db/listen";
// const link2 = "https://worship247.streamguys1.com/live-mp3-web";
// https://www.allworship.com/

const RadioRenderer = () => {
  const pluginApi = usePluginAPI();
  const isPlaying = pluginApi.renderer.useData((x) => x.isPlaying);

  const canPlay = pluginApi.audio.useCanPlay({ skipCheck: !isPlaying });

  if (!canPlay) {
    return null;
  }
  return <RadioRendererInner />;
};

const RadioRendererInner = () => {
  const pluginApi = usePluginAPI();

  const ref = useRef<HTMLAudioElement>(null);

  const isPlaying = pluginApi.renderer.useData((x) => x.isPlaying);
  const volume = pluginApi.renderer.useData((x) => x.volume);

  const [localIsPlaying, setLocalIsPlaying] = useState(false);

  useEffect(() => {
    if (isPlaying && !localIsPlaying) {
      ref.current?.play();
    } else if (!isPlaying && localIsPlaying) {
      ref.current?.pause();
    }
  }, [isPlaying, localIsPlaying]);

  useEffect(() => {
    if (ref.current) {
      ref.current.volume = Math.min(Math.max(0, volume ?? 1), 1);
    }
  }, [volume]);

  return (
    <audio
      controls
      ref={ref}
      onPlay={() => {
        setLocalIsPlaying(true);
      }}
      onPause={() => {
        setLocalIsPlaying(false);
      }}
    >
      <source
        src="https://worship247.streamguys1.com/live-mp3-web"
        type="audio/mp3"
      />
      <source
        src="https://worship247.streamguys1.com/live-aac-web"
        type="audio/aac"
      />
      <source
        src="https://worship247.streamguys1.com/live-aac-web?type=.flv"
        type="audio/rtmp"
      />
    </audio>
  );
};

export default RadioRenderer;
