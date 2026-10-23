import {
  PresentationInfo,
  SlideAnimationData,
  SlideAnimationSequence,
  SlideFlyDirection,
  SlideFlyType,
  SlideInfo,
  SlideKeyframeEasingType,
  SlideVideo,
} from "./types";

export function extractDocData(html: string): any[] | null {
  // Find the start of docData
  const startMatch = html.match(/docData:\s*\[/);
  if (!startMatch || startMatch.index === undefined) return null;

  const startIndex = startMatch.index + startMatch[0].length - 1;

  // Count brackets to find the matching end bracket
  let depth = 0;
  let endIndex = startIndex;
  for (let i = startIndex; i < html.length; i++) {
    const char = html[i];
    if (char === "[") depth++;
    else if (char === "]") {
      depth--;
      if (depth === 0) {
        endIndex = i + 1;
        break;
      }
    }
  }

  const docDataStr = html.substring(startIndex, endIndex);

  try {
    return JSON.parse(docDataStr);
  } catch {
    return null;
  }
}

/** An autoplay object that takes no time, but is still there */
const AUTOPLAY_VIDEO_MS = 1;

/**
 * Parses video data from slide field
 */
function parseVideoData(videoArray: any[]): SlideVideo | null {
  if (!videoArray || videoArray.length < 19) return null;

  const boundsArray = videoArray[2] as number[] | undefined;
  return {
    videoId: videoArray[0] || "",
    videoType: videoArray[1] || 0,
    bounds: {
      x: boundsArray?.[0] || 0,
      y: boundsArray?.[1] || 0,
      width: (boundsArray?.[2] || 0) - (boundsArray?.[0] || 0),
      height: (boundsArray?.[3] || 0) - (boundsArray?.[1] || 0),
    },
    startTime: videoArray[5] || 0,
    endTime: videoArray[6] || 0,
    title: videoArray[8] || "",
    description: videoArray[9] || "",
    elementId: videoArray[10] || "",
    blobId: videoArray[11] || "",
    thumbnailUrl: videoArray[12] || "",
    scaleX: videoArray[17] || 1,
    scaleY: videoArray[18] || 1,
  };
}

/**
 * Parses animation data from slide field
 */
function parseAnimationData(
  animData: any[],
  slideId: string,
): SlideAnimationData {
  const result: SlideAnimationData = {
    sequences: [],
    autoPlay: false,
  };

  if (!animData || animData.length < 3) return result;

  const sequences = animData[0] || [];
  result.autoPlay = animData[1] || false;

  for (const seq of sequences) {
    if (!seq || seq.length < 1) continue;

    const animSequence: SlideAnimationSequence = {
      animations: [],
      totalDurationMs: seq[1] || 0,
    };

    const steps = seq[0] || [];
    for (const step of steps) {
      if (!step || step.length < 10) continue;

      // The first keyframe, `[easing, …]`. Most effects nest it a level
      // deeper than a video's play step does, so find it rather than assume
      let firstKeyframe: any[] = step[0] || [];
      while (Array.isArray(firstKeyframe[0])) firstKeyframe = firstKeyframe[0];
      const easingType =
        (firstKeyframe[0] as SlideKeyframeEasingType) ??
        SlideKeyframeEasingType.AppearDisappearFade;

      const targetElementId = step[1] || "";
      const byParagraph = targetElementId.includes("-paragraph-");
      const isSlideTransition = targetElementId === slideId;

      let flyType: SlideFlyType | undefined;
      let flyDirection: SlideFlyDirection | undefined;
      if (easingType === SlideKeyframeEasingType.Fly) {
        if (firstKeyframe[2] !== 0) {
          flyType = SlideFlyType.In;
          flyDirection =
            firstKeyframe[2] < 0
              ? SlideFlyDirection.Left
              : SlideFlyDirection.Right;
        } else if (firstKeyframe[3] !== 0) {
          flyType = SlideFlyType.Out;
          flyDirection =
            firstKeyframe[3] < 0
              ? SlideFlyDirection.Down
              : SlideFlyDirection.Up;
        } else if (firstKeyframe[4] !== 0) {
          flyType = firstKeyframe[4] < 0 ? SlideFlyType.Out : SlideFlyType.In;
          flyDirection =
            firstKeyframe[4] < 0
              ? SlideFlyDirection.Down
              : SlideFlyDirection.Up;
        }
      }

      const durationMs = step[8] || 0;

      animSequence.animations.push({
        targetElementId,
        easingType,
        isSlideTransition,
        byParagraph,
        durationMs,
        flyType,
        flyDirection,
      });
    }

    result.sequences.push(animSequence);
  }

  return result;
}

/**
 * Extracts presentation info from docData
 */
export function parsePresentationInfo(docData: any[]): PresentationInfo | null {
  if (!docData || docData.length < 2) return null;

  const dimensions = docData[0];
  const slidesArray = docData[1];

  const slides: SlideInfo[] = [];

  for (const slide of slidesArray) {
    if (!slide || slide.length < 15) continue;

    // Parse videos from field 4
    const videos: SlideVideo[] = [];
    const videoData = slide[4] || [];
    for (const v of videoData) {
      const video = parseVideoData(v);
      if (video) videos.push(video);
    }

    // Parse animations from field 7
    const animations = parseAnimationData(slide[7], slide[0] || "");

    let clickCount = 0;
    let slideTransitionDurationMs = 0;
    let hasSlideTransition = false;
    let hasAutoplayObject = false;
    let autoplayObjectDurationMs = 0;
    const clickDurationsMs: number[] = [];
    const videoClicks: Record<string, number> = {};
    const autoplayVideoIds: string[] = [];
    const playedVideos = (seq: SlideAnimationSequence) =>
      seq.animations
        .filter((anim) => anim.easingType === SlideKeyframeEasingType.MediaPlay)
        .map((anim) => anim.targetElementId);
    for (const [seqIndex, seq] of animations.sequences.entries()) {
      const isSlideTransition = seq.animations[0]?.isSlideTransition;

      if (isSlideTransition) {
        hasSlideTransition = true;
        slideTransitionDurationMs = seq.animations[0]?.durationMs ?? 0;

        // For some reason, slide transition has 2 item. So only if there's 3 or more, there's more stuff there
        // (an object that is set to show with/after previous)
        if (seq.animations.length > 2) {
          hasAutoplayObject = true;
          autoplayObjectDurationMs = Math.max(
            autoplayObjectDurationMs,
            seq.totalDurationMs - slideTransitionDurationMs,
          );
        }
        autoplayVideoIds.push(...playedVideos(seq));
        // Transition also set autoPlay to true, but we already use the if above, so this just detects object autoplay
      } else if (seqIndex === 0 && animations.autoPlay) {
        hasAutoplayObject = true;
        autoplayObjectDurationMs = Math.max(
          autoplayObjectDurationMs,
          seq.totalDurationMs,
        );
        autoplayVideoIds.push(...playedVideos(seq));
      } else {
        clickCount += 1;
        const videos = playedVideos(seq);
        // The embed's video can't play, so its step would never finish; the
        // renderer finishes it at once, so it takes no time (AGENTS.md §10)
        clickDurationsMs.push(videos.length > 0 ? 0 : seq.totalDurationMs);
        for (const id of videos) videoClicks[id] ??= clickCount;
      }
    }
    // Same for an automatic one, which still counts as an autoplay object:
    // that is what gives the slide its -1 sub-step
    if (autoplayVideoIds.length > 0) {
      autoplayObjectDurationMs = AUTOPLAY_VIDEO_MS;
    }

    slides.push({
      slideId: slide[0] || "",
      slideIndex: slide[1] || 0,
      title: slide[2] || "",
      videos,
      animations,
      speakerNotes: slide[9] || "",
      imageUrls: slide[10] || [],
      elementImageMap: slide[13] || {},
      clickCount,
      hasAnimations: clickCount > 0,
      hasSlideTransition,
      slideTransitionDurationMs,
      hasAutoplayObject,
      autoplayObjectDurationMs,
      clickDurationsMs,
      videoClicks,
      autoplayVideoIds,
    });
  }

  return {
    width: dimensions[0],
    height: dimensions[1],
    slides,
    slideCount: slides.length,
  };
}

/**
 * Main function to extract all slide data from HTML
 */
export function extractSlideData(html: string): PresentationInfo | null {
  const docData = extractDocData(html);
  if (!docData) return null;
  return parsePresentationInfo(docData);
}
