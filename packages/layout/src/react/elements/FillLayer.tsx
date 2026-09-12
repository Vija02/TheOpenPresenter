import {
  ALLOWED_IMAGE_WIDTH,
  UniversalURL,
  isInternalMedia,
  resolveMediaUrl,
  resolveProcessedMediaUrl,
} from "@repo/lib";
import { ReactNode, useEffect, useRef, useState } from "react";
import { LuImageOff } from "react-icons/lu";

import { ImagePaint, FillPaint } from "../../schema/paint";
import { VideoFill } from "./VideoFill";

const WIDTHS = [...ALLOWED_IMAGE_WIDTH].sort((a, b) => a - b);

// Media is published into the document before the worker finishes uploading it,
// so a fresh slide can 404 for a few seconds. Retry with a growing delay before
// giving up.
const RETRY_DELAYS_MS = [1500, 3000, 6000];

const withRetry = (url: string, attempt: number): string =>
  attempt === 0
    ? url
    : `${url}${url.includes("?") ? "&" : "?"}retry=${attempt}`;

const srcSetOf = (src: UniversalURL, attempt: number): string =>
  WIDTHS.map((size) => {
    const url = resolveProcessedMediaUrl({ mediaUrl: src, size });
    return url ? `${withRetry(url, attempt)} ${size}w` : null;
  })
    .filter((x): x is string => x !== null)
    .join(", ");

const sizesFor = (renderedWidth: number): string | undefined => {
  if (!Number.isFinite(renderedWidth) || renderedWidth <= 0) return undefined;
  const bucket = WIDTHS.find((w) => w > renderedWidth);
  return `${bucket ?? Math.ceil(renderedWidth)}px`;
};

export type FillLayerProps = {
  fill: FillPaint | null;
  width?: number;
  /** The id of the element this fill belongs to */
  elementId: string;
};

/** The absolutely-positioned box that media fills are drawn into. */
const MediaLayer = ({
  opacity,
  children,
}: {
  opacity: number;
  children: ReactNode;
}) => (
  <div
    aria-hidden
    style={{
      position: "absolute",
      inset: 0,
      borderRadius: "inherit",
      overflow: "hidden",
      opacity: opacity < 1 ? opacity : undefined,
      zIndex: 0,
    }}
  >
    {children}
  </div>
);

/** Shown in place of an image whose media never loaded. */
const ImageFallback = () => (
  <div
    style={{
      width: "100%",
      height: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "rgba(0, 0, 0, 0.35)",
      color: "rgba(255, 255, 255, 0.4)",
    }}
  >
    <LuImageOff size="20%" />
  </div>
);

/**
 * Draws an image fill and keeps trying while the media is still uploading. A
 * bare <img> would show the browser's broken-image icon on a 404; instead we
 * retry a few times and then fall back to a placeholder.
 */
const ImageFill = ({
  src,
  paint,
  sizes,
}: {
  src: string;
  paint: ImagePaint;
  sizes: string | undefined;
}) => {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setAttempt(0);
    setFailed(false);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [src]);

  if (failed) return <ImageFallback />;

  const handleError = () => {
    if (attempt >= RETRY_DELAYS_MS.length) {
      setFailed(true);
      return;
    }
    timerRef.current = setTimeout(
      () => setAttempt((n) => n + 1),
      RETRY_DELAYS_MS[attempt],
    );
  };

  return (
    <img
      key={attempt}
      src={withRetry(src, attempt)}
      alt=""
      draggable={false}
      onError={handleError}
      {...(sizes ? { sizes, srcSet: srcSetOf(paint.src, attempt) } : {})}
      style={{
        width: "100%",
        height: "100%",
        objectFit: paint.fit,
        display: "block",
      }}
    />
  );
};

/**
 * Draws a picture or video fill behind the element's own content.
 */
export const FillLayer = ({ fill, width, elementId }: FillLayerProps) => {
  if (fill?.type === "video") {
    return (
      <MediaLayer opacity={fill.opacity}>
        <VideoFill fill={fill} elementId={elementId} />
      </MediaLayer>
    );
  }

  if (fill?.type !== "image") return null;

  const src = resolveMediaUrl(fill.src);
  if (!src) return null;

  // Only internal media has processed variants, and without a known render
  // width the browser would assume 100vw and fetch the largest one.
  const sizes = isInternalMedia(fill.src) ? sizesFor(width ?? 0) : undefined;

  // DEBT: Make the image case use UniversalImage
  return (
    <MediaLayer opacity={fill.opacity}>
      <ImageFill src={src} paint={fill} sizes={sizes} />
    </MediaLayer>
  );
};
