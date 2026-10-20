import useSize from "@react-hook/size";
import {
  CSSProperties,
  ReactNode,
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  type SlideFrame,
  type TargetState,
  evaluateSlide,
} from "../../../src/office/evaluate";
import { mediaPlayback } from "../../../src/office/media";
import { type SlideTimeline, targetKey } from "../../../src/office/timeline";
import type {
  OfficeDeck,
  OfficeSlide,
  OfficeSprite,
} from "../../../src/office/types";
import { clipStyle } from "./clipStyles";

/** A sprite sheet's url, and its real size when the url may be a smaller copy */
export type ResolveImage = (
  imageId: string,
) => { url: string; size?: { w: number; h: number } } | undefined;
export type ResolveMedia = (mediaId: string) => string | undefined;

type OfficeSlideViewProps = {
  deck: OfficeDeck;
  slide: OfficeSlide;
  timeline: SlideTimeline;
  /** Internal click group to show (0 = before any) */
  group: number;
  /** Time since the group's click. `SETTLED` for its end state */
  elapsedMs: number;
  resolveImage: ResolveImage;
  /** Videos only play when given; previews leave it out */
  resolveMedia?: ResolveMedia;
  /** 0..1, on top of each video's own volume */
  volume?: number;
  style?: CSSProperties;
};

/**
 * One PowerPoint slide, drawn from the sprites PowerPoint for the web rendered
 * and animated by our own timeline. Fills its container, letterboxed.
 */
export const OfficeSlideView = ({
  deck,
  slide,
  timeline,
  group,
  elapsedMs,
  resolveImage,
  resolveMedia,
  volume = 1,
  style,
}: OfficeSlideViewProps) => {
  const frame = useMemo(
    () =>
      evaluateSlide(slide, timeline, group, elapsedMs, {
        width: deck.width,
        height: deck.height,
      }),
    [slide, timeline, group, elapsedMs, deck.width, deck.height],
  );
  const media = useMemo(
    () =>
      resolveMedia
        ? mediaPlayback(slide, timeline, group, elapsedMs)
        : NO_MEDIA,
    [resolveMedia, slide, timeline, group, elapsedMs],
  );

  return (
    <SlideStage deck={deck} style={style}>
      <SlideBackground slide={slide} resolveImage={resolveImage} />
      <Shapes slide={slide} frame={frame} resolveImage={resolveImage} />
      {resolveMedia &&
        slide.shapes.map((shape) => {
          const position = media.get(shape.id);
          const src =
            shape.media?.id != null
              ? resolveMedia(shape.media.id)
              : shape.media?.url;
          if (position === undefined || !shape.media || !src) return null;
          return (
            <OfficeVideo
              key={shape.id}
              src={src}
              box={{
                x: shape.x,
                y: shape.y,
                w: shape.region?.w ?? 0,
                h: shape.region?.h ?? 0,
              }}
              positionMs={position}
              loop={shape.media.loop}
              volume={shape.media.volume * volume}
            />
          );
        })}
    </SlideStage>
  );
};

/** A slide-sized canvas in slide pixels, scaled to fit its container */
export const SlideStage = ({
  deck,
  style,
  children,
}: {
  deck: Pick<OfficeDeck, "width" | "height">;
  style?: CSSProperties;
  children: ReactNode;
}) => {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const [width, height] = useSize(element);
  const scale =
    width > 0 && height > 0
      ? Math.min(width / deck.width, height / deck.height)
      : 0;

  return (
    <div
      ref={setElement}
      data-testid="office-slide"
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        ...style,
      }}
    >
      {scale > 0 && (
        <div
          style={{
            position: "absolute",
            left: (width - deck.width * scale) / 2,
            top: (height - deck.height * scale) / 2,
            width: deck.width,
            height: deck.height,
            transform: `scale(${scale})`,
            transformOrigin: "0 0",
            overflow: "hidden",
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
};

export const SlideBackground = ({
  slide,
  resolveImage,
  style,
}: {
  slide: OfficeSlide;
  resolveImage: ResolveImage;
  style?: CSSProperties;
}) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      background:
        slide.background.type === "color" ? slide.background.color : "#ffffff",
      ...style,
    }}
  >
    {slide.background.type === "image" && (
      <Sprite
        sprite={slide.background.sprite}
        state={null}
        resolveImage={resolveImage}
      />
    )}
  </div>
);

const NO_MEDIA = new Map<number, number>();

const Shapes = memo(
  ({
    slide,
    frame,
    resolveImage,
  }: {
    slide: OfficeSlide;
    frame: SlideFrame;
    resolveImage: ResolveImage;
  }) => (
    <>
      {slide.shapes.map((shape) => (
        <ShapeView
          key={shape.id}
          shape={shape}
          frame={frame}
          resolveImage={resolveImage}
        />
      ))}
    </>
  ),
);

const ShapeView = ({
  shape,
  frame,
  resolveImage,
}: {
  shape: OfficeSlide["shapes"][number];
  frame: SlideFrame;
  resolveImage: ResolveImage;
}) => {
  const state = frame.get(targetKey(shape.id)) ?? null;
  // A shape with its own image only needs its pieces while something builds
  // them; one without (text split up for a build or a morph) is its pieces
  const builtPieces = shape.children
    .map((child, index) => ({
      child,
      state: frame.get(targetKey(shape.id, index)),
    }))
    .filter((piece) => !shape.region || piece.state !== undefined);

  return (
    <>
      {shape.region && (
        <Sprite
          sprite={{ x: shape.x, y: shape.y, region: shape.region }}
          state={state}
          resolveImage={resolveImage}
        />
      )}
      {state?.overlay && (
        <Sprite
          sprite={state.overlay.sprite}
          state={{ ...state, overlay: null, alpha: state.overlay.alpha }}
          resolveImage={resolveImage}
        />
      )}
      {builtPieces.map(({ child, state: pieceState }, index) => (
        <Sprite
          key={index}
          sprite={child}
          state={pieceState ?? null}
          resolveImage={resolveImage}
        />
      ))}
    </>
  );
};

export const Sprite = ({
  sprite,
  state,
  resolveImage,
}: {
  sprite: OfficeSprite;
  state: TargetState | null;
  resolveImage: ResolveImage;
}) => {
  const image = resolveImage(sprite.region.img);
  if (!image) return null;
  if (state && !state.visible) return null;

  const { region } = sprite;
  // PowerPoint for the web animates the sprite rectangle's edges directly
  // (wipes, peeks), moving the image with them
  const cropL = state?.cropL ?? 0;
  const cropT = state?.cropT ?? 0;
  const w = region.w + (state?.cropR ?? 0) - cropL;
  const h = region.h + (state?.cropB ?? 0) - cropT;
  if (w <= 0 || h <= 0) return null;

  const clip = state?.clip
    ? clipStyle(state.clip.kind, state.clip.progress)
    : null;
  const transforms: string[] = [];
  if (state && state.rotate !== 0) {
    transforms.push(`rotate(${state.rotate}rad)`);
  }
  if (state && (state.scaleX !== 1 || state.scaleY !== 1)) {
    transforms.push(`scale(${state.scaleX}, ${state.scaleY})`);
  }

  return (
    <div
      style={{
        position: "absolute",
        left: sprite.x + (state?.x ?? 0),
        top: sprite.y + (state?.y ?? 0),
        width: w,
        height: h,
        backgroundImage: `url("${image.url}")`,
        // A smaller copy is stretched back to the sheet's real size
        backgroundSize: image.size
          ? `${image.size.w}px ${image.size.h}px`
          : undefined,
        backgroundPosition: `${-(region.x + cropL)}px ${-(region.y + cropT)}px`,
        backgroundRepeat: "no-repeat",
        opacity: (state?.alpha ?? 1) * (clip?.opacity ?? 1),
        transform: transforms.length > 0 ? transforms.join(" ") : undefined,
        transformOrigin: "50% 50%",
        pointerEvents: "none",
        ...clip?.style,
      }}
    />
  );
};

/** Drift (ms) we let a playing video have before seeking it back in line */
const VIDEO_SYNC_TOLERANCE_MS = 400;

/**
 * A playing video, kept at `positionMs`. The element plays on its own between
 * updates; we only seek when it drifts, so playback stays smooth.
 */
const OfficeVideo = ({
  src,
  box,
  positionMs,
  loop,
  volume,
}: {
  src: string;
  box: { x: number; y: number; w: number; h: number };
  positionMs: number;
  loop: boolean;
  volume: number;
}) => {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    video.volume = Math.max(0, Math.min(1, volume));
    if (
      Math.abs(video.currentTime * 1000 - positionMs) > VIDEO_SYNC_TOLERANCE_MS
    ) {
      video.currentTime = positionMs / 1000;
    }
    if (video.paused) {
      video.play().catch(() => {
        // Sound can be blocked until the page is interacted with
        video.muted = true;
        void video.play().catch(() => {});
      });
    }
  }, [positionMs, volume]);

  return (
    <video
      ref={ref}
      src={src}
      loop={loop}
      playsInline
      style={{
        position: "absolute",
        left: box.x,
        top: box.y,
        width: box.w,
        height: box.h,
        objectFit: "fill",
        pointerEvents: "none",
      }}
    />
  );
};
