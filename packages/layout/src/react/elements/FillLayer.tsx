import {
  ALLOWED_IMAGE_WIDTH,
  UniversalURL,
  isInternalMedia,
  resolveMediaUrl,
  resolveProcessedMediaUrl,
} from "@repo/lib";
import { ReactNode } from "react";

import { FillPaint } from "../../schema/paint";
import { VideoFill } from "./VideoFill";

const WIDTHS = [...ALLOWED_IMAGE_WIDTH].sort((a, b) => a - b);

const srcSetOf = (src: UniversalURL): string =>
  WIDTHS.map((size) => {
    const url = resolveProcessedMediaUrl({ mediaUrl: src, size });
    return url ? `${url} ${size}w` : null;
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
      <img
        src={src}
        alt=""
        draggable={false}
        {...(sizes ? { sizes, srcSet: srcSetOf(fill.src) } : {})}
        style={{
          width: "100%",
          height: "100%",
          objectFit: fill.fit,
          display: "block",
        }}
      />
    </MediaLayer>
  );
};
