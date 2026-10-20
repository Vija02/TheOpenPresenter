import { describe, expect, it } from "vitest";

import type { OfficeDeck } from "../../../../src/office/types";
import { officeImageResolver, officeMediaUrl } from "../officeImageUrl";

type Name = { mediaId: string; extension: string };
const media = {
  resolveMediaUrl: ({ mediaId, extension }: Name) =>
    `http://localhost/media/data/${mediaId}.${extension}`,
  // Stands in for lib's, which picks WebP when the browser supports it
  resolveProcessedMediaUrl: ({
    mediaUrl: { mediaId, extension },
    size,
  }: {
    mediaUrl: Name;
    size: number;
  }) =>
    `http://localhost/media/processed/${size}/${mediaId}.${extension}?format=webp`,
};
const file = "media_01m5cc0m4ff6abt0nck3eqfbe9.png";

const deck = (imageSizes?: OfficeDeck["imageSizes"]): OfficeDeck => ({
  width: 1920,
  height: 1080,
  images: { S1: file, old: `/media/data/${file}` },
  ...(imageSizes ? { imageSizes } : {}),
  slides: [],
});

describe("officeImageResolver", () => {
  it("resolves sprites stored with the media path by early imports", () => {
    expect(officeImageResolver(deck(), media)("old")?.url).toBe(
      `http://localhost/media/processed/3840/${file}?format=webp`,
    );
    expect(officeMediaUrl(`/media/data/${file}`, media)).toBe(
      `http://localhost/media/data/${file}`,
    );
  });
});
