import { PluginAPIContext } from "@repo/base-plugin/client";
import { createVideoPlaybackState } from "@repo/video";
import { VideoPlayer } from "@repo/video/client";
import {
  CSSProperties,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

import {
  VideoPaint,
  toInternalVideo,
  videoPosterPlaceholderUrl,
  videoPosterUrl,
} from "../../schema/paint";
import { useLayoutActiveSince } from "../context/ActiveContext";
import {
  type VideoFillPlaybackState,
  useVideoFillMode,
  useVideoFillPlaybackState,
  useVideoFillScope,
} from "../context/VideoFillContext";

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

/** The chrome around the player: object-fit plumbing and the poster fade-in. */
const PlayerFrame = ({
  fill,
  children,
  loaded,
}: {
  fill: VideoPaint;
  children: ReactNode;
  loaded: boolean;
}) => {
  // react-player renders its own <video>, which we cannot style directly.
  const objectFitStyle = {
    "--lay-video-fit": fill.fit,
  } as CSSProperties;

  const placeholder = videoPosterPlaceholderUrl(fill.video);

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

      {children}
    </div>
  );
};

const useResolvedVideo = (fill: VideoPaint) => {
  const [measured, setMeasured] = useState<number | null>(null);

  const duration = fill.video.duration ?? measured;

  const video = useMemo(() => {
    const base = toInternalVideo(fill.video);
    if (duration === null) return base;
    return { ...base, metadata: { ...base.metadata, duration } };
  }, [fill.video, duration]);

  const onDurationChange = useCallback((next: number) => {
    if (Number.isFinite(next) && next > 0) setMeasured(next);
  }, []);

  return { video, onDurationChange };
};

/**
 * Ambient background playback: always looping, always muted.
 */
const LoopPlayer = ({ fill }: { fill: VideoPaint }) => {
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

  const { video, onDurationChange } = useResolvedVideo(fill);

  const [loaded, setLoaded] = useState(false);

  return (
    <PlayerFrame fill={fill} loaded={loaded}>
      <VideoPlayer
        key={fill.video.id}
        video={video}
        playbackState={playbackState}
        forceLoop
        onDurationChange={onDurationChange}
        onLoadedChange={setLoaded}
      />
    </PlayerFrame>
  );
};

/** One-shot playback: runs from the first frame when the slide becomes active */
const OncePlayer = ({
  fill,
  since,
  stored,
}: {
  fill: VideoPaint;
  since: number | null;
  stored: VideoFillPlaybackState | undefined;
}) => {
  const { pluginAPI } = useContext(PluginAPIContext);
  const [loaded, setLoaded] = useState(false);

  const derived = useMemo(
    () =>
      createVideoPlaybackState({
        isPlaying: since !== null,
        onFinishBehaviour: "pause",
        seek: 0,
        startedAt: since ?? 0,
      }),
    [since],
  );

  const playbackState = stored ?? derived;

  const volume = pluginAPI!.audio.useVolume(playbackState.volume);

  const { video, onDurationChange } = useResolvedVideo(fill);

  return (
    <PlayerFrame fill={fill} loaded={loaded}>
      <VideoPlayer
        key={fill.video.id}
        video={video}
        playbackState={{
          ...playbackState,
          volume,
          muted: playbackState.muted || volume === 0,
        }}
        onDurationChange={onDurationChange}
        onLoadedChange={setLoaded}
      />
    </PlayerFrame>
  );
};

export const VideoFill = ({
  fill,
  elementId,
}: {
  fill: VideoPaint;
  elementId: string;
}) => {
  const mode = useVideoFillMode();
  const since = useLayoutActiveSince();
  const scope = useVideoFillScope();
  const stored = useVideoFillPlaybackState({ scope, elementId });
  const { pluginAPI } = useContext(PluginAPIContext);

  if (mode === "poster" || !pluginAPI) return <Poster fill={fill} />;

  if ((fill.playback ?? "loop") === "once") {
    return (
      <OncePlayer
        fill={fill}
        since={since}
        stored={since === null ? undefined : stored}
      />
    );
  }

  return <LoopPlayer fill={fill} />;
};
