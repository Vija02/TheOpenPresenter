import { LayoutRenderer } from "@repo/layout/react";
import { CSSProperties, useMemo } from "react";

import { backgroundScope, resolveLiveBackground } from "../../src/activation";
import { resolveSceneBackgrounds } from "../../src/backgrounds";
import { sceneBackground } from "../../src/template/layout";
import { usePluginAPI } from "../pluginApi";

const EMPTY_DATA = {};

const containerStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  zIndex: 0,
  overflow: "hidden",
  pointerEvents: "none",
};

/** Mounts every background any song in the scene can reach */
const BackgroundRenderer = () => {
  const pluginApi = usePluginAPI();
  const songId = pluginApi.renderer.useData((x) => x.songId);
  const currentIndex = pluginApi.renderer.useData((x) => x.currentIndex);
  const backgroundRun = pluginApi.renderer.useData((x) => x.backgroundRun);

  const songs = pluginApi.scene.useData((x) => x.pluginData.songs);
  const background = pluginApi.scene.useData((x) => x.pluginData.background);

  const reachable = useMemo(
    () => resolveSceneBackgrounds(songs, sceneBackground({ background })),
    [songs, background],
  );

  // Which background shows is a pure function of song and position, so it
  // always matches the remote. The run only supplies its playback clock
  const liveKey = useMemo(
    () =>
      resolveLiveBackground(
        { songs, background: sceneBackground({ background }) },
        songId ?? null,
        currentIndex ?? null,
      )?.key ?? null,
    [songs, background, songId, currentIndex],
  );
  const since =
    backgroundRun && backgroundRun.key === liveKey ? backgroundRun.since : null;

  return (
    <div
      style={containerStyle}
      data-testid="lyrics-background"
      data-active-key={liveKey ?? ""}
      data-run-since={since ?? ""}
    >
      {reachable.map(({ key, background }) => {
        const isActive = key === liveKey;

        return (
          <div
            key={key}
            data-background-key={key}
            data-active={isActive}
            style={{
              position: "absolute",
              inset: 0,
              zIndex: isActive ? 1 : 0,
              opacity: isActive ? 1 : 0,
              transition: "opacity 300ms ease-in-out",
            }}
          >
            <LayoutRenderer
              doc={background}
              data={EMPTY_DATA}
              activeSince={isActive ? since : null}
              scope={backgroundScope(key)}
            />
          </div>
        );
      })}
    </div>
  );
};

export default BackgroundRenderer;
