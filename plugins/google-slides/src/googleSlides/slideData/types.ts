// Types for Google Slides docData extraction

export interface SlideKeyframe {
  easingType: number;
  unknown1: number;
  value1: number;
  value2: number;
  opacity: number;
  unknown2: number;
}

export interface SlideAnimation {
  keyframes: SlideKeyframe[];
  targetElementId: string;
  unknown1: number;
  unknown2: number;
  animationType: number;
  onClick: boolean;
  unknown3: boolean;
  startDelay: number;
  unknown4: number;
  duration: number;
}

export interface SlideAnimationSequence {
  animations: SlideAnimation[];
  timing: number;
  duration: number;
}

export interface SlideAnimationData {
  sequences: SlideAnimationSequence[];
  autoPlay: boolean;
  defaultDuration: number;
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
