import { PluginAPIContext } from "@repo/base-plugin/client";
import { createVideoPlaybackState } from "@repo/video";
import { VideoPlayer } from "@repo/video/client";
import { CSSProperties, useContext, useMemo, useState } from "react";

import {
  VideoPaint,
  toInternalVideo,
  videoPosterPlaceholderUrl,
  videoPosterUrl,
} from "../../schema/paint";
import { useVideoFillMode } from "../VideoFillContext";

const Poster = ({ fill }: { fill: VideoPaint }) => {
  const src = videoPosterUrl(fill.video);

  if (!src) return null;

  return (
    <img
      src={src}
      alt=""
      draggable={false}
      style={{
        width: "100%",
        height: "100%",
        objectFit: fill.fit,
        display: "block",
      }}
    />
  );
};

/**
 * Ambient background playback: always looping, always muted.
 */
const Player = ({ fill }: { fill: VideoPaint }) => {
  const playbackState = useMemo(
    () =>
      createVideoPlaybackState({
        isPlaying: true,
        onFinishBehaviour: "loop",
        muted: true,
        volume: 0,
        startedAt: 0,
      }),
    [],
  );

  const video = useMemo(() => toInternalVideo(fill.video), [fill.video]);

  const [loaded, setLoaded] = useState(false);
  const placeholder = videoPosterPlaceholderUrl(fill.video);

  // react-player renders its own <video>, which we cannot style directly.
  const objectFitStyle = {
    "--lay-video-fit": fill.fit,
  } as CSSProperties;

  return (
    <div className="lay--video-fill" style={objectFitStyle}>
      {placeholder && (
        <img
          aria-hidden
          src={placeholder}
          alt=""
          draggable={false}
          className="lay--video-placeholder"
          data-loaded={loaded ? "" : undefined}
          style={{ objectFit: fill.fit }}
        />
      )}

      <VideoPlayer
        key={fill.video.id}
        video={video}
        playbackState={playbackState}
        forceLoop
        onLoadedChange={setLoaded}
      />
    </div>
  );
};

export const VideoFill = ({ fill }: { fill: VideoPaint }) => {
  const mode = useVideoFillMode();
  const { pluginAPI } = useContext(PluginAPIContext);

  if (mode === "poster" || !pluginAPI) return <Poster fill={fill} />;

  return <Player fill={fill} />;
};
