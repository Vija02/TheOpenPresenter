import { getFeedDataProvider } from "@repo/base-plugin/client";
import isEqual from "fast-deep-equal";
import { useEffect, useMemo, useRef, useState } from "react";

import { LayoutFeed } from "../schema/feed";
import { FeedFrames, namespaceFeedData } from "../template/feedData";
import { FrameData } from "../template/spans";

export type FeedSourceResolver = (feed: LayoutFeed) => {
  pluginName: string;
  sceneData: unknown;
  rendererData: unknown;
}[];

const collect = (
  feeds: LayoutFeed[],
  resolveSources: FeedSourceResolver,
): FrameData => {
  const frames: FeedFrames = {};

  for (const feed of feeds) {
    for (const entry of resolveSources(feed)) {
      const data = getFeedDataProvider(entry.pluginName)?.getData({
        sceneData: entry.sceneData,
        rendererData: entry.rendererData,
        derivation: feed.derivation,
      });
      if (!data) continue;

      // A feed covering several plugins merges them, first one wins per key.
      frames[feed.name] = { ...(data as FrameData), ...frames[feed.name] };
    }
  }

  return namespaceFeedData(frames);
};

/** Whether any provider's value moves on its own, e.g. an autoplaying deck. */
const anyLive = (
  feeds: LayoutFeed[],
  resolveSources: FeedSourceResolver,
): boolean =>
  feeds.some((feed) =>
    resolveSources(feed).some((entry) =>
      getFeedDataProvider(entry.pluginName)?.isLive?.({
        sceneData: entry.sceneData,
        rendererData: entry.rendererData,
        derivation: feed.derivation,
      }),
    ),
  );

/** Token values for every feed a document reads, as `{{feed.key}}` */
export const useFeedData = (
  feeds: LayoutFeed[],
  resolveSources: FeedSourceResolver,
): FrameData => {
  const derived = useMemo(
    () => collect(feeds, resolveSources),
    [feeds, resolveSources],
  );

  const live = useMemo(
    () => anyLive(feeds, resolveSources),
    [feeds, resolveSources],
  );

  // Read by the animation loop so it sees the current document without having
  // to restart: `resolveSources` closes over Yjs state and changes identity on
  // every unrelated edit.
  const latest = useRef({ feeds, resolveSources });
  latest.current = { feeds, resolveSources };

  const [ticked, setTicked] = useState<FrameData | null>(null);

  useEffect(() => {
    if (!live) {
      setTicked(null);
      return;
    }

    let frame: number;
    const loop = () => {
      const next = collect(latest.current.feeds, latest.current.resolveSources);
      // Compared by value: the clock moves every frame but the tokens it
      // produces rarely do, and a new object each time would re-render the
      // whole layout at 60fps.
      setTicked((previous) =>
        previous && isEqual(previous, next) ? previous : next,
      );
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(frame);
  }, [live]);

  return ticked ?? derived;
};

export const resolveFeedSources = (
  state: { data: Record<string, any>; renderer: Record<string, any> },
  feed: LayoutFeed,
) => {
  const { source } = feed;
  const sceneId =
    source.kind === "screen"
      ? (state.renderer[source.rendererId]?.currentScene ?? null)
      : source.sceneId;
  if (!sceneId) return [];

  const scene = state.data[sceneId];
  const rendererScene =
    state.renderer[source.rendererId]?.children?.[sceneId] ?? {};

  return Object.entries<any>(scene?.children ?? {})
    .filter(
      ([, plugin]) =>
        source.kind !== "plugin" || plugin.plugin === source.pluginId,
    )
    .map(([pluginId, plugin]) => ({
      pluginName: plugin.plugin,
      sceneData: plugin,
      rendererData: rendererScene[pluginId],
    }));
};
