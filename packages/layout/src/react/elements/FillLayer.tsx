import {
  ALLOWED_IMAGE_WIDTH,
  UniversalURL,
  isInternalMedia,
  resolveMediaUrl,
  resolveProcessedMediaUrl,
} from "@repo/lib";

import { FillPaint } from "../../schema/paint";

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
};

/**
 * Draws an image fill as a real `<img>` behind the element's own content.
 */
// DEBT: Make this use UniversalImage
export const FillLayer = ({ fill, width }: FillLayerProps) => {
  if (fill?.type !== "image") return null;

  const src = resolveMediaUrl(fill.src);
  if (!src) return null;

  // Only internal media has processed variants, and without a known render
  // width the browser would assume 100vw and fetch the largest one.
  const sizes = isInternalMedia(fill.src) ? sizesFor(width ?? 0) : undefined;

  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        borderRadius: "inherit",
        overflow: "hidden",
        opacity: fill.opacity < 1 ? fill.opacity : undefined,
        zIndex: 0,
      }}
    >
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
    </div>
  );
};
