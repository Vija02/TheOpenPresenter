// Types for Google Slides docData extraction

export enum SlideKeyframeEasingType {
  AppearDisappearFade = 0,
  Spin = 1,
  Zoom = 2,
  Fly = 3,
}

export enum SlideFlyType {
  In = "in",
  Out = "out",
}

export enum SlideFlyDirection {
  Left = "left",
  Right = "right",
  Up = "up",
  Down = "down",
}

export interface SlideAnimation {
  targetElementId: string;
  easingType: SlideKeyframeEasingType;
  isSlideTransition: boolean;
  byParagraph: boolean;
  durationMs: number;
  flyType?: SlideFlyType; // unconfirmed
  flyDirection?: SlideFlyDirection; // unconfirmed
}

export interface SlideAnimationSequence {
  animations: SlideAnimation[];
  totalDurationMs: number;
}

export interface SlideAnimationData {
  sequences: SlideAnimationSequence[];
  autoPlay: boolean;
}

export interface SlideVideo {
  videoId: string;
  videoType: number; // 1 = YouTube
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  startTime: number;
  endTime: number;
  title: string;
  description: string;
  elementId: string;
  blobId: string;
  thumbnailUrl: string;
  scaleX: number;
  scaleY: number;
}

export interface SlideInfo {
  slideId: string;
  slideIndex: number;
  title: string;
  videos: SlideVideo[];
  animations: SlideAnimationData;
  speakerNotes: string;
  imageUrls: string[];
  elementImageMap: Record<string, string>;
  clickCount: number;
  hasAnimations: boolean;
  hasSlideTransition: boolean;
  slideTransitionDurationMs: number;
  clickDurationsMs: number[];
  hasAutoplayObject: boolean;
  autoplayObjectDurationMs: number;
}

export interface PresentationInfo {
  width: number;
  height: number;
  slides: SlideInfo[];
  slideCount: number;
}

export interface SlideChange {
  slideId: string;
  slideIndex: number;
  changeType: "added" | "removed" | "modified";
  oldFingerprint?: string;
  newFingerprint?: string;
}

export interface SlideDigest {
  slideId: string;
  slideIndex: number;
  title: string;
  clickCount: number;
  hasVideo: boolean;
  imageCount: number;
  fingerprint: string;
}
