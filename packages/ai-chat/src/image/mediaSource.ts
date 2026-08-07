import {
  ALLOWED_IMAGE_WIDTH,
  extractMediaName,
  isBrowserSupportedImageFile,
  resolveMediaUrl,
  resolveProcessedMediaUrl,
} from "@repo/lib";

import type { AiChatImageSource, AiChatPickedImage } from "./types";

const TARGET_WIDTH =
  [...ALLOWED_IMAGE_WIDTH].sort((a, b) => a - b).find((w) => w >= 1024) ??
  Math.max(...ALLOWED_IMAGE_WIDTH);

export const resolvePickedImage = (
  picked: AiChatPickedImage,
): AiChatImageSource => {
  if (typeof picked === "string") return picked;

  let parsed: ReturnType<typeof extractMediaName>;
  try {
    parsed = extractMediaName(picked.mediaName);
  } catch {
    return picked.mediaName;
  }

  const candidates: string[] = [];

  // Resolve an image that has been processed for correct size
  if (isBrowserSupportedImageFile(parsed.extension)) {
    const processed = resolveProcessedMediaUrl({
      mediaUrl: parsed,
      size: TARGET_WIDTH,
    });
    if (processed) candidates.push(processed);
  }

  candidates.push(resolveMediaUrl(parsed));
  return candidates;
};
