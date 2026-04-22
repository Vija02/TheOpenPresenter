import { extractSlideData } from "./slideDataExtractor";
import { SlideInfo } from "./types";

export function getSlideIds(html: string): string[] | null {
  const data = extractSlideData(html);
  if (!data) return null;

  return data.slides.map((slide) => slide.slideId);
}

export function getSlideById(html: string, slideId: string): SlideInfo | null {
  const data = extractSlideData(html);
  if (!data) return null;

  return data.slides.find((slide) => slide.slideId === slideId) ?? null;
}

export function getSlideByIndex(
  html: string,
  slideIndex: number,
): SlideInfo | null {
  const data = extractSlideData(html);
  if (!data) return null;

  return data.slides.find((slide) => slide.slideIndex === slideIndex) ?? null;
}
