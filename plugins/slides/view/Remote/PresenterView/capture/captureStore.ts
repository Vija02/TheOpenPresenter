/**
 * Captured pictures of Google Slides positions
 */
export type CaptureKey = string;

export const captureKey = (
  fetchId: string,
  localSlideIndex: number,
  clickCount: number,
): CaptureKey => `${fetchId}|${localSlideIndex}|${clickCount}`;

const captures = new Map<CaptureKey, SVGSVGElement>();
const listeners = new Set<() => void>();

export const captureStore = {
  get: (key: CaptureKey) => captures.get(key),
  has: (key: CaptureKey) => captures.has(key),
  set: (key: CaptureKey, svg: SVGSVGElement) => {
    captures.set(key, svg);
    listeners.forEach((listener) => listener());
  },
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
