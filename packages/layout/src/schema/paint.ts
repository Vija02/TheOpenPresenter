import type { InternalVideo } from "@repo/base-types";
import {
  ALLOWED_IMAGE_WIDTH,
  extractMediaName,
  resolveMediaUrl,
  resolveProcessedMediaUrl,
  universalURLValidator,
} from "@repo/lib";
import { z } from "zod";

const PLACEHOLDER_WIDTH = Math.min(...ALLOWED_IMAGE_WIDTH);

export const solidPaintValidator = z.object({
  type: z.literal("solid"),
  /** Any CSS colour. */
  color: z.string(),
  opacity: z.number(),
});

export const linearGradientPaintValidator = z.object({
  type: z.literal("linearGradient"),
  /** Degrees, 0 = top-to-bottom. */
  angle: z.number(),
  stops: z.array(
    z.object({
      /** 0–1 along the gradient. */
      offset: z.number(),
      color: z.string(),
    }),
  ),
  opacity: z.number(),
});

export const paintValidator = z.discriminatedUnion("type", [
  solidPaintValidator,
  linearGradientPaintValidator,
]);

export const imageFitModes = ["contain", "cover", "fill"] as const;
export type ImageFitMode = (typeof imageFitModes)[number];

export const imagePaintValidator = z.object({
  type: z.literal("image"),
  src: universalURLValidator,
  fit: z.enum(imageFitModes),
  opacity: z.number(),
});

export const layoutVideoValidator = z.object({
  id: z.string(),
  url: z.string(),
  hlsMediaName: z.string().nullable(),
  thumbnailMediaName: z.string().nullable(),
  title: z.string().nullable(),
  duration: z.number().nullable(),
  thumbnailUrl: z.string().nullable(),
});

export const videoPaintValidator = z.object({
  type: z.literal("video"),
  video: layoutVideoValidator,
  fit: z.enum(imageFitModes),
  opacity: z.number(),
});

export const fillPaintValidator = z.discriminatedUnion("type", [
  solidPaintValidator,
  linearGradientPaintValidator,
  imagePaintValidator,
  videoPaintValidator,
]);

export type SolidPaint = z.infer<typeof solidPaintValidator>;
export type LinearGradientPaint = z.infer<typeof linearGradientPaintValidator>;
export type ImagePaint = z.infer<typeof imagePaintValidator>;
export type LayoutVideo = z.infer<typeof layoutVideoValidator>;
export type VideoPaint = z.infer<typeof videoPaintValidator>;
export type Paint = z.infer<typeof paintValidator>;
export type FillPaint = z.infer<typeof fillPaintValidator>;

export const strokeAlignments = ["inside", "center", "outside"] as const;
export type StrokeAlignment = (typeof strokeAlignments)[number];

export const strokeValidator = z.object({
  paint: paintValidator,
  /** Design units. */
  width: z.number(),
  align: z.enum(strokeAlignments),
});

export type Stroke = z.infer<typeof strokeValidator>;

export const shadowValidator = z.object({
  /** Design units. */
  x: z.number(),
  y: z.number(),
  blur: z.number(),
  spread: z.number(),
  color: z.string(),
  inner: z.boolean(),
});

export type Shadow = z.infer<typeof shadowValidator>;

export const effectValidator = z.discriminatedUnion("type", [
  shadowValidator.extend({ type: z.literal("shadow") }),
  z.object({
    type: z.literal("blur"),
    /** Design units. */
    radius: z.number(),
  }),
]);

export type Effect = z.infer<typeof effectValidator>;

export const solidPaint = (color: string, opacity = 1): SolidPaint => ({
  type: "solid",
  color,
  opacity,
});

export const sortGradientStops = (
  stops: LinearGradientPaint["stops"],
): LinearGradientPaint["stops"] =>
  [...stops].sort((a, b) => a.offset - b.offset);

export const imagePaint = (
  src: ImagePaint["src"],
  fit: ImageFitMode = "cover",
  opacity = 1,
): ImagePaint => ({
  type: "image",
  src,
  fit,
  opacity,
});

export const linearGradientPaint = (
  angle: number,
  stops: LinearGradientPaint["stops"],
  opacity = 1,
): LinearGradientPaint => ({
  type: "linearGradient",
  angle,
  stops: sortGradientStops(stops),
  opacity,
});

/** Narrows the picker's `InternalVideo` to what a document can store. */
export const toLayoutVideo = (video: InternalVideo): LayoutVideo => ({
  id: video.id,
  url: video.url,
  hlsMediaName: video.hlsMediaName,
  thumbnailMediaName: video.thumbnailMediaName,
  title: video.metadata.title ?? null,
  duration: video.metadata.duration ?? null,
  thumbnailUrl: video.metadata.thumbnailUrl ?? null,
});

/** Widens a stored video back into the shape the player expects. */
export const toInternalVideo = (video: LayoutVideo): InternalVideo => ({
  id: video.id,
  url: video.url,
  isInternalVideo: true,
  hlsMediaName: video.hlsMediaName,
  thumbnailMediaName: video.thumbnailMediaName,
  metadata: {
    ...(video.title === null ? {} : { title: video.title }),
    ...(video.duration === null ? {} : { duration: video.duration }),
    ...(video.thumbnailUrl === null
      ? {}
      : { thumbnailUrl: video.thumbnailUrl }),
  },
});

export const videoPosterUrl = (video: LayoutVideo): string | null => {
  if (video.thumbnailUrl) return video.thumbnailUrl;
  if (video.thumbnailMediaName) {
    try {
      return resolveMediaUrl(extractMediaName(video.thumbnailMediaName));
    } catch {
      return null;
    }
  }
  return null;
};

export const videoPosterPlaceholderUrl = (
  video: LayoutVideo,
): string | null => {
  if (!video.thumbnailMediaName) return null;
  try {
    const { mediaId, extension } = extractMediaName(video.thumbnailMediaName);
    return (
      resolveProcessedMediaUrl({
        mediaUrl: { mediaId, extension },
        size: PLACEHOLDER_WIDTH,
      }) ?? null
    );
  } catch {
    return null;
  }
};

export const videoPaint = (
  video: LayoutVideo,
  fit: ImageFitMode = "cover",
  opacity = 1,
): VideoPaint => ({
  type: "video",
  video,
  fit,
  opacity,
});
