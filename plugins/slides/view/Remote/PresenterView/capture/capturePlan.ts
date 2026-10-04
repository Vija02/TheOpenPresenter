/**
 * How to visit every position of one Google Slides slide in the embed, ending
 * each step on a finished picture. The rules come from measuring the embed;
 * see `src/importers/googleSlides/embed-capture.md`.
 */

export type SlideTiming = {
  /** On-click builds on the slide */
  maxClicks: number;
  /** Object that animates by itself when the slide is entered. 0 = none */
  autoplayMs: number;
  /** Animation length of each build, in order */
  clickDurationsMs: number[];
};

export type CaptureStep =
  /** Jump to the slide: lands on build 0, plays no transition */
  | { kind: "go" }
  | { kind: "next" }
  | { kind: "prev" }
  /**
   * Finish the animation that is playing. Right finishes it and starts the
   * next build, Left removes that build at once. Only valid while another
   * build follows on the same slide.
   */
  | { kind: "snap" }
  /** Let the animation play out; the embed must look stable afterwards */
  | { kind: "settle"; minMs: number }
  | { kind: "capture"; clickCount: number };

/**
 * Steps that land the embed at `clickCount`, which has just started its
 * animation (or none). With a later build to snap to, the animation is
 * skipped; at the last build a Right would cross to the next slide, so it is
 * waited out instead.
 */
const finish = (
  timing: SlideTiming,
  clickCount: number,
  animationMs: number,
): CaptureStep[] => {
  if (animationMs <= 0) return [{ kind: "settle", minMs: 0 }];
  if (clickCount < timing.maxClicks) {
    return [{ kind: "snap" }, { kind: "settle", minMs: 0 }];
  }
  return [{ kind: "settle", minMs: animationMs }];
};

export const slideCapturePlan = (timing: SlideTiming): CaptureStep[] => {
  const steps: CaptureStep[] = [
    { kind: "go" },
    ...finish(timing, 0, timing.autoplayMs),
    { kind: "capture", clickCount: 0 },
  ];

  // -1 (the slide without its autoplay object) is only reachable by going
  // back from 0. Going forward again replays the autoplay object.
  if (timing.autoplayMs > 0) {
    steps.push(
      { kind: "prev" },
      { kind: "settle", minMs: 0 },
      { kind: "capture", clickCount: -1 },
      { kind: "next" },
      ...finish(timing, 0, timing.autoplayMs),
    );
  }

  for (let click = 1; click <= timing.maxClicks; click++) {
    steps.push(
      { kind: "next" },
      ...finish(timing, click, timing.clickDurationsMs[click - 1] ?? 0),
      { kind: "capture", clickCount: click },
    );
  }

  return steps;
};
