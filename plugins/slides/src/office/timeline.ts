import type { OfficeAnimation, OfficeSlide } from "./types";

/**
 * Turns a slide's main animation sequence into click groups with absolute
 * start times, following PowerPoint for the web's `translateAnimations`:
 *
 * - The first animation always starts a click group. If it was really
 *   "with/after previous", that first group plays by itself on slide entry
 *   (`autoStart`) instead of waiting for a click.
 * - "With previous" starts alongside the start of the current chain;
 *   "after previous" starts when everything so far in the group has ended.
 * - Building by paragraph/word/letter staggers each piece by `childDelayMs`,
 *   the first one included.
 */

/** `"<shapeId>"`, or `"<shapeId>:<childIndex>"` for one built piece */
export type TargetKey = string;

export type ScheduledAnim = {
  anim: OfficeAnimation;
  /** 1-based click group */
  group: number;
  /** Start, in ms after the group's click */
  startMs: number;
  /** Length of one play */
  playMs: number;
  /** Plays, with auto-reverse counted as one more. Infinity for until-click/slide */
  plays: number;
  target: TargetKey;
};

export type SlideTimeline = {
  groups: number;
  autoStart: boolean;
  /** How long each group takes to finish, by group (index 0 = group 1) */
  groupDurationsMs: number[];
  items: ScheduledAnim[];
  /** Targets that wait offstage for an entrance */
  initiallyHidden: Set<TargetKey>;
};

export const targetKey = (shapeId: number, child: number | null = null) =>
  child === null ? String(shapeId) : `${shapeId}:${child}`;

const isUntimed = (anim: OfficeAnimation) =>
  anim.duration.type !== "timed" || typeof anim.repeat !== "number";

/** One play's length. Untimed effects are near-instant, as in the viewer */
export const playDuration = (anim: OfficeAnimation) =>
  anim.duration.type === "timed" ? Math.max(1, anim.duration.ms) : 1;

const playCount = (anim: OfficeAnimation) => {
  if (typeof anim.repeat !== "number") return Infinity;
  let plays = 1;
  if (anim.autoReverse && (anim.kind === "emphasis" || anim.kind === "path")) {
    plays *= 2;
  }
  return plays * (anim.repeat + 1);
};

export const compileTimeline = (slide: OfficeSlide): SlideTimeline => {
  const shapes = new Map(slide.shapes.map((shape) => [shape.id, shape]));
  const items: ScheduledAnim[] = [];
  const groupDurationsMs: number[] = [];

  let group = 0;
  let chainStart = 0;
  let groupEnd = 0;
  let offset = 0;
  let previousUntimed = false;

  slide.animations.forEach((anim, index) => {
    const start = index === 0 ? "click" : anim.start;
    const untimed = isUntimed(anim);
    const playMs = playDuration(anim);
    const plays = playCount(anim);
    const runMs = untimed ? 0 : plays * playMs;

    const pieces =
      anim.childDelayMs >= 0
        ? (shapes.get(anim.shapeId)?.children.length ?? 0)
        : 0;
    const staggerMs = pieces * Math.max(0, anim.childDelayMs);

    if (start === "click") {
      group += 1;
      offset = anim.delayMs;
      chainStart = 0;
      groupEnd = offset + runMs + staggerMs;
    } else if (start === "with") {
      offset = chainStart + anim.delayMs;
      groupEnd = Math.max(groupEnd, offset + runMs + staggerMs);
    } else {
      offset = previousUntimed
        ? offset + anim.delayMs
        : groupEnd + anim.delayMs;
      chainStart = groupEnd;
      groupEnd = offset + runMs + staggerMs;
    }
    previousUntimed = untimed;
    groupDurationsMs[group - 1] = Math.max(
      groupDurationsMs[group - 1] ?? 0,
      groupEnd,
    );

    if (pieces > 0) {
      for (let piece = 0; piece < pieces; piece++) {
        items.push({
          anim,
          group,
          startMs: offset + (piece + 1) * anim.childDelayMs,
          playMs,
          plays,
          target: targetKey(anim.shapeId, piece),
        });
      }
    } else {
      items.push({
        anim,
        group,
        startMs: offset,
        playMs,
        plays,
        target: targetKey(anim.shapeId),
      });
    }
  });

  const initiallyHidden = new Set<TargetKey>();
  const seen = new Set<TargetKey>();
  for (const item of items) {
    if (seen.has(item.target)) continue;
    seen.add(item.target);
    if (item.anim.kind === "entrance") initiallyHidden.add(item.target);
  }

  const first = slide.animations[0];
  return {
    groups: group,
    autoStart: !!first && first.start !== "click",
    groupDurationsMs,
    items,
    initiallyHidden,
  };
};

/**
 * The timeline in the navigation model's terms (see
 * `src/importers/googleSlides/AGENTS.md`): an automatic first group is the
 * slide's autoplay object, every other group is one click.
 */
export const navigationTiming = (timeline: SlideTimeline) => {
  const auto = timeline.autoStart ? 1 : 0;
  return {
    clickCount: Math.max(0, timeline.groups - auto),
    autoplayMs: auto ? (timeline.groupDurationsMs[0] ?? 0) : 0,
    clickDurationsMs: timeline.groupDurationsMs.slice(auto),
  };
};

/**
 * The internal group to show for a navigation click count. `-1` is the
 * autoplay-rewind sub-step: the slide before its automatic group.
 */
export const groupForClickCount = (
  timeline: SlideTimeline,
  clickCount: number,
) => {
  if (clickCount < 0) return 0;
  const group = clickCount + (timeline.autoStart ? 1 : 0);
  return Math.min(group, timeline.groups);
};
