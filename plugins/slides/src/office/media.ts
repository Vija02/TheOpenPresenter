import { SETTLED } from "./evaluate";
import type { SlideTimeline } from "./timeline";
import type { OfficeMedia, OfficeSlide } from "./types";

/**
 * Which videos/sounds on a slide are playing, and how far in (ms into the
 * file), `elapsedMs` after `group`'s click. Like the animations, this is a pure
 * function of the step and its start time, so every screen plays in step.
 *
 * Playback is only known for the step that just started: a video started by
 * an earlier click (or after a jump) shows its poster instead.
 */
export const mediaPlayback = (
  slide: OfficeSlide,
  timeline: SlideTimeline,
  group: number,
  elapsedMs: number,
): Map<number, number> => {
  const playing = new Map<number, number>();
  if (elapsedMs === SETTLED) return playing;

  const shapes = new Map(slide.shapes.map((shape) => [shape.id, shape]));
  const play = (shapeId: number, media: OfficeMedia, startMs: number) => {
    const t = elapsedMs - startMs;
    if (t < 0) return;
    const length = media.durationMs - media.trimStartMs - media.trimEndMs;
    if (length <= 0) return;
    if (!media.loop && t >= length) return;
    playing.set(shapeId, media.trimStartMs + (t % length));
  };

  // Set to start by themselves: they begin as the slide opens
  const entryGroup = timeline.autoStart ? 1 : 0;
  if (group === entryGroup) {
    for (const shape of slide.shapes) {
      if (shape.media?.autoPlay) play(shape.id, shape.media, 0);
    }
  }

  for (const item of timeline.items) {
    if (item.group !== group || item.anim.kind !== "media") continue;
    const media = shapes.get(item.anim.shapeId)?.media;
    if (media) play(item.anim.shapeId, media, item.startMs);
  }

  return playing;
};
