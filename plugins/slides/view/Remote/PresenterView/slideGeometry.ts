import { AspectRatio, DEFAULT_ASPECT_RATIO } from "@repo/layout";

import { resolvedSlideDoc } from "../../../src/customSlides";
import type { ResolvedSlide } from "../../../src/types";

export const aspectRatioValue = (ratio: AspectRatio) =>
  ratio.width / ratio.height;

export const aspectRatioCss = (ratio: AspectRatio) =>
  `${ratio.width} / ${ratio.height}`;

export const slideAspectRatio = (slide: ResolvedSlide | null) =>
  slide ? resolvedSlideDoc(slide).aspectRatio : DEFAULT_ASPECT_RATIO;
