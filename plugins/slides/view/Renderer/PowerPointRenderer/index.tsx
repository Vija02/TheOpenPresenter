import { VIDEO_VOLUME_KEY } from "@repo/base-types";
import { useWebPSupport } from "@repo/lib";
import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { SETTLED, groupEndMs } from "../../../src/office/evaluate";
import { collectSlideImageIds } from "../../../src/office/normalize";
import {
  type SlideTimeline,
  compileTimeline,
  groupForClickCount,
} from "../../../src/office/timeline";
import {
  type TransitionPlayback,
  transitionPlayback,
} from "../../../src/office/transitions";
import type { OfficeDeck, OfficeSlide } from "../../../src/office/types";
import { resolveSlide } from "../../../src/slides/order";
import {
  type DisplayMode,
  type PluginBaseData,
  type ResolvedSlide,
  getEffectiveDisplayMode,
  hasOfficeSlideshow,
} from "../../../src/types";
import { usePluginAPI } from "../../pluginApi";
import { useDisplayedSlide } from "../../utils/useDisplayedSlide";
import { ImageRenderView } from "../ImageRenderer/ImageRenderView";
import { MorphView } from "./MorphView";
import {
  OfficeSlideView,
  type ResolveImage,
  type ResolveMedia,
} from "./OfficeSlideView";
import { officeImageResolver, officeMediaUrl } from "./officeImageUrl";
import { useSpriteStore } from "./spriteStore";
import { transitionFrame } from "./transitionStyles";

const RENDERER_ID = "__powerpoint_renderer__";

type OfficeSlideRef = {
  globalIndex: number;
  thumbnailUrl: string;
  deck: OfficeDeck;
  slide: OfficeSlide;
  timeline: SlideTimeline;
};

// Timelines are pure functions of the slide; compile each once
const timelineCache = new WeakMap<OfficeSlide, SlideTimeline>();
const timelineFor = (slide: OfficeSlide) => {
  let timeline = timelineCache.get(slide);
  if (!timeline) {
    timeline = compileTimeline(slide);
    timelineCache.set(slide, timeline);
  }
  return timeline;
};

const officeSlideAt = (
  pluginData: PluginBaseData,
  globalIndex: number,
  displayModes: Record<string, DisplayMode> | undefined,
): OfficeSlideRef | null => {
  if (globalIndex < 0) return null;
  const resolved: ResolvedSlide | null = resolveSlide(pluginData, globalIndex);
  if (!resolved) return null;
  const { importData, localSlideIndex } = resolved;
  if (!hasOfficeSlideshow(importData)) return null;
  if (getEffectiveDisplayMode(importData, displayModes) !== "powerpoint") {
    return null;
  }
  const slide = importData.office.slides[localSlideIndex];
  if (!slide) return null;
  return {
    globalIndex,
    thumbnailUrl: resolved.thumbnailUrl,
    deck: importData.office,
    slide,
    timeline: timelineFor(slide),
  };
};

/** Re-renders every frame until `until` (epoch ms), then stops */
const useAnimationNow = (until: number | null) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (until === null || Date.now() >= until) return;
    let frame = 0;
    const tick = () => {
      const t = Date.now();
      setNow(t);
      if (t < until) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [until]);
  return Math.max(now, Date.now());
};

/** Warms the browser cache with videos/sounds so they start without a wait */
const usePrefetchedFiles = (urls: string[]) => {
  const fetched = useRef(new Set<string>());
  useEffect(() => {
    for (const url of urls) {
      if (fetched.current.has(url)) continue;
      fetched.current.add(url);
      void fetch(url, { priority: "low" } as RequestInit).catch(() => {
        fetched.current.delete(url);
      });
    }
  }, [urls]);
};

type Playback = {
  playing: boolean;
  group: number;
  /** Builds on an entered slide wait for its transition */
  groupDelay: number;
  /** Epoch ms when nothing moves any more, or null when nothing plays */
  until: number | null;
  other: OfficeSlideRef | null;
  forward: boolean;
  backward: boolean;
  transition: TransitionPlayback;
};

/** What to draw for this step, and for how long it moves */
const playbackFor = ({
  current,
  clickCount,
  activeSince,
  playing,
  entryFrom,
  globalSlideIndex,
  resolveOther,
}: {
  current: OfficeSlideRef | null;
  clickCount: number;
  activeSince: number | null;
  /** Only the step a press just started animates; anything else lands settled */
  playing: boolean;
  entryFrom: number | null;
  globalSlideIndex: number;
  resolveOther: (index: number) => OfficeSlideRef | null;
}): Playback | null => {
  if (!current) return null;
  const group = groupForClickCount(current.timeline, clickCount);
  const enteringStep = clickCount <= 0;

  // Forward: this slide's transition. Backward: the left slide's, reversed
  const forward = enteringStep && entryFrom === globalSlideIndex - 1;
  const backward = enteringStep && entryFrom === globalSlideIndex + 1;
  const other =
    (forward || backward) && entryFrom !== null
      ? resolveOther(entryFrom)
      : null;
  const transition = transitionPlayback(
    playing && (forward || backward)
      ? ((backward ? other?.slide : current.slide)?.transition ?? null)
      : null,
  );

  const groupDelay = forward ? transition.durationMs : 0;
  const until =
    playing && activeSince !== null
      ? activeSince +
        Math.max(
          transition.durationMs,
          groupDelay + groupEndMs(current.timeline, group),
        ) +
        50
      : null;

  return {
    playing,
    group,
    groupDelay,
    until,
    other,
    forward,
    backward,
    transition,
  };
};

export const PowerPointRenderer = ({
  onLoadingChange,
}: {
  onLoadingChange: (id: string, isLoading: boolean) => void;
}) => {
  const pluginApi = usePluginAPI();
  const pluginData = pluginApi.scene.useData((x) => x.pluginData);
  const displayModes = pluginApi.renderer.useData((x) => x.displayModes);
  const transitionEndsAt = pluginApi.renderer.useData(
    (x) => x.transitionEndsAt,
  );
  const autoplayEnabled = pluginApi.renderer.useData(
    (x) => !!x.autoplay?.enabled,
  );
  const volume = pluginApi.renderer.useData((x) => x[VIDEO_VOLUME_KEY] ?? 1);
  const { globalSlideIndex, clickCount, activeSince } = useDisplayedSlide();

  const current = useMemo(
    () => officeSlideAt(pluginData, globalSlideIndex, displayModes),
    [pluginData, globalSlideIndex, displayModes],
  );

  // Which slide we came from, to play the transition between the two
  const [entry, setEntry] = useState<{ index: number; from: number | null }>(
    () => ({ index: globalSlideIndex, from: null }),
  );
  if (entry.index !== globalSlideIndex) {
    setEntry({ index: globalSlideIndex, from: entry.index });
  }

  // Image urls depend on it: wait rather than load everything twice
  const webpSupport = useWebPSupport();

  const resolveMedia = useMemo<ResolveMedia>(
    () => (mediaId) => {
      const fileName = current?.deck.media?.[mediaId];
      return fileName ? officeMediaUrl(fileName, pluginApi.media) : undefined;
    },
    [current, pluginApi.media],
  );

  // Everything every PowerPoint slide needs, loaded as soon as the renderer
  // is on, so jumping anywhere shows at once (like the other renderers)
  const { imageUrls, currentUrls, nearbyUrls, mediaUrls } = useMemo(() => {
    if (webpSupport === null) {
      return { imageUrls: [], currentUrls: [], nearbyUrls: [], mediaUrls: [] };
    }
    const imageUrls = new Set<string>();
    const mediaUrls = new Set<string>();
    let currentUrls: string[] = [];
    // One press away either way, decoded ahead so the change is instant
    const nearbyUrls = new Set<string>();
    for (let index = 0; index < pluginData.slideOrder.length; index++) {
      const ref = officeSlideAt(pluginData, index, displayModes);
      if (!ref) continue;
      const resolve = officeImageResolver(ref.deck, pluginApi.media);
      const urls = [...collectSlideImageIds(ref.slide)].flatMap((id) => {
        const image = resolve(id);
        return image ? [image.url] : [];
      });
      urls.forEach((url) => imageUrls.add(url));
      if (index === globalSlideIndex) currentUrls = urls;
      if (Math.abs(index - globalSlideIndex) <= 1) {
        urls.forEach((url) => nearbyUrls.add(url));
      }
      for (const shape of ref.slide.shapes) {
        const fileName =
          shape.media?.id != null ? ref.deck.media?.[shape.media.id] : null;
        if (fileName) mediaUrls.add(officeMediaUrl(fileName, pluginApi.media));
      }
    }
    return {
      imageUrls: [...imageUrls],
      currentUrls,
      nearbyUrls: [...nearbyUrls],
      mediaUrls: [...mediaUrls],
    };
  }, [
    webpSupport,
    pluginData,
    displayModes,
    globalSlideIndex,
    pluginApi.media,
  ]);
  const sprites = useSpriteStore({
    all: imageUrls,
    required: currentUrls,
    decodeUrls: nearbyUrls,
  });
  const allLoaded = webpSupport !== null && sprites.allLoaded;
  const ready = webpSupport !== null && sprites.ready;
  const resolveSprite = sprites.resolve;

  // Sprites come from memory once loaded; see spriteStore.ts
  const spriteResolver = useCallback(
    (deck: OfficeDeck): ResolveImage => {
      const resolve = officeImageResolver(deck, pluginApi.media);
      return (imageId) => {
        const image = resolve(imageId);
        return image && { ...image, url: resolveSprite(image.url) };
      };
    },
    [pluginApi.media, resolveSprite],
  );

  const resolveImage = useMemo<ResolveImage>(
    () =>
      current && webpSupport !== null
        ? spriteResolver(current.deck)
        : () => undefined,
    [current, webpSupport, spriteResolver],
  );

  usePrefetchedFiles(mediaUrls);

  useEffect(() => {
    onLoadingChange(RENDERER_ID, !allLoaded);
  }, [allLoaded, onLoadingChange]);
  useEffect(() => () => onLoadingChange(RENDERER_ID, false), [onLoadingChange]);

  const playback = playbackFor({
    current,
    clickCount,
    activeSince,
    playing:
      activeSince !== null &&
      (autoplayEnabled || (transitionEndsAt ?? 0) > activeSince),
    entryFrom: entry.from,
    globalSlideIndex,
    resolveOther: (index) => officeSlideAt(pluginData, index, displayModes),
  });
  const now = useAnimationNow(playback?.until ?? null);

  if (!current || !playback) return null;

  const { group, groupDelay, other, forward, transition } = playback;
  const elapsed = playback.playing ? now - activeSince! : SETTLED;
  const progress =
    transition.durationMs > 0
      ? Math.min(1, Math.max(0, elapsed / transition.durationMs))
      : 1;

  const currentView = (style?: CSSProperties) =>
    ready && (
      <OfficeSlideView
        key="current"
        deck={current.deck}
        slide={current.slide}
        timeline={current.timeline}
        group={group}
        elapsedMs={
          elapsed === SETTLED ? SETTLED : Math.max(0, elapsed - groupDelay)
        }
        resolveImage={resolveImage}
        resolveMedia={resolveMedia}
        volume={volume}
        style={style}
      />
    );

  // Both slides on screen while the transition runs: the slide being left
  // (as it ended) and the one arriving. Backwards plays it in reverse.
  let layers: ReactNode = currentView();
  if (other && progress < 1 && transition.kind !== "cut") {
    const otherView = (style: CSSProperties) => (
      <OfficeSlideView
        key="other"
        deck={other.deck}
        slide={other.slide}
        timeline={other.timeline}
        group={forward ? other.timeline.groups : 0}
        elapsedMs={SETTLED}
        resolveImage={spriteResolver(other.deck)}
        style={style}
      />
    );
    const t = forward ? progress : 1 - progress;
    // The pairs belong to the later slide's transition, whichever way we go
    const morph = (forward ? current : other).slide.transition?.morph;
    if (transition.kind === "morph" && morph) {
      const currentSide = { slide: current.slide, resolveImage };
      const otherSide = {
        slide: other.slide,
        resolveImage: spriteResolver(other.deck),
      };
      layers = (
        <MorphView
          key="morph"
          deck={current.deck}
          pairs={morph}
          from={forward ? otherSide : currentSide}
          to={forward ? currentSide : otherSide}
          t={t}
        />
      );
    } else {
      const frame = transitionFrame(transition.kind, transition.direction, t);
      const from = forward ? otherView(frame.from) : currentView(frame.from);
      const to = forward ? currentView(frame.to) : otherView(frame.to);
      layers = frame.fromOnTop ? [to, from] : [from, to];
    }
  }

  return (
    <div style={{ position: "absolute", inset: 0, background: "black" }}>
      {!ready && current.thumbnailUrl && (
        <ImageRenderView src={current.thumbnailUrl} isActive />
      )}
      {layers}
    </div>
  );
};
