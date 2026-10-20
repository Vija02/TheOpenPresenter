import { ALLOWED_IMAGE_WIDTH } from "@repo/lib";

/**
 * The sprite sheet variants we ask `/media/processed` for. The importer
 * requests these right after upload so they're ready before anyone presents;
 * the renderer gets the same ones, WebP being its default where supported.
 */
export const OFFICE_SPRITE_FORMAT = "webp" as const;

export type OfficeSpriteTier = "full" | "preview";

export const OFFICE_SPRITE_WIDTHS: Record<OfficeSpriteTier, number> = {
  // The endpoint never enlarges, so the largest width means "full size"
  full: Math.max(...ALLOWED_IMAGE_WIDTH),
  preview: 640,
};

/** Pixel size of a PNG or GIF, from its header */
export const imageDimensions = (
  buffer: Buffer,
): { w: number; h: number } | null => {
  if (buffer.length >= 24 && buffer.readUInt32BE(0) === 0x89504e47) {
    return { w: buffer.readUInt32BE(16), h: buffer.readUInt32BE(20) };
  }
  if (buffer.length >= 10 && buffer.toString("latin1", 0, 3) === "GIF") {
    return { w: buffer.readUInt16LE(6), h: buffer.readUInt16LE(8) };
  }
  return null;
};
