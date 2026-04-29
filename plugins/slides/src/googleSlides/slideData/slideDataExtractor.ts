import {
  PresentationInfo,
  SlideAnimationData,
  SlideAnimationSequence,
  SlideInfo,
  SlideKeyframe,
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
      width: boundsArray?.[2] || 0,
      height: boundsArray?.[3] || 0,
    },
    startTime: videoArray[4] || 0,
    endTime: videoArray[5] || 0,
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
function parseAnimationData(animData: any[]): SlideAnimationData {
  const result: SlideAnimationData = {
    sequences: [],
    autoPlay: false,
    defaultDuration: 1000,
  };

  if (!animData || animData.length < 3) return result;

  const sequences = animData[0] || [];
  result.autoPlay = animData[1] || false;
  result.defaultDuration = animData[2] || 1000;

  for (const seq of sequences) {
    if (!seq || seq.length < 1) continue;

    const animSequence: SlideAnimationSequence = {
      animations: [],
      timing: seq[1] || 0,
      duration: seq[2] || 0,
    };

    const steps = seq[0] || [];
    for (const step of steps) {
      if (!step || step.length < 10) continue;

      const keyframes: SlideKeyframe[] = [];
      const kfArray = step[0] || [];
      for (const kf of kfArray) {
        if (kf && kf.length >= 6) {
          keyframes.push({
            easingType: kf[0],
            unknown1: kf[1],
            value1: kf[2],
            value2: kf[3],
            opacity: kf[4],
            unknown2: kf[5],
          });
        }
      }

      animSequence.animations.push({
        keyframes,
        targetElementId: step[1] || "",
        unknown1: step[2] || 0,
        unknown2: step[3] || 0,
        animationType: step[4] || 0,
        onClick: step[5] || false,
        unknown3: step[6] || false,
        startDelay: step[7] || 0,
        unknown4: step[8] || 0,
        duration: step[9] || 0,
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
    const animations = parseAnimationData(slide[7]);

    // Click count = number of animation sequences
    const clickCount = animations.sequences.length;

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
