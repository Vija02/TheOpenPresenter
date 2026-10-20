import { useSyncExternalStore } from "react";

/**
 * Whether this browser can show WebP, with transparency. Browsers that can
 * encode WebP can decode it, so Chromium answers at once; Safari can only
 * decode, so it loads a sample instead, which takes a moment. Call
 * `detectWebPSupport` at startup so the answer is in before images load.
 */

// 1x1 lossy WebP with an alpha channel
const WEBP_WITH_ALPHA =
  "data:image/webp;base64,UklGRkoAAABXRUJQVlA4WAoAAAAQAAAAAAAAAAAAQUxQSAwAAAARBxAR/Q9ERP8DAABWUDggGAAAABQBAJ0BKgEAAQAAAP4AAA3AAP7mtQAAAA==";

let supported: boolean | null = null;
let detection: Promise<boolean> | null = null;
const listeners = new Set<() => void>();

const settle = (value: boolean) => {
  supported = value;
  listeners.forEach((listener) => listener());
  return value;
};

const canvasEncodesWebP = () => {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    return canvas.toDataURL("image/webp").startsWith("data:image/webp");
  } catch {
    return false;
  }
};

export const detectWebPSupport = (): Promise<boolean> => {
  if (detection) return detection;
  if (typeof window === "undefined" || typeof Image === "undefined") {
    detection = Promise.resolve(settle(false));
  } else if (canvasEncodesWebP()) {
    detection = Promise.resolve(settle(true));
  } else {
    detection = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(settle(img.width > 0 && img.height > 0));
      img.onerror = () => resolve(settle(false));
      img.src = WEBP_WITH_ALPHA;
    });
  }
  return detection;
};

/** True or false once known; null while the check hasn't finished */
export const getWebPSupport = (): boolean | null => supported;

export const subscribeWebPSupport = (listener: () => void) => {
  listeners.add(listener);
  // Started here rather than while rendering: a check that answers at once
  // notifies listeners, which must not happen mid-render
  void detectWebPSupport();
  return () => {
    listeners.delete(listener);
  };
};

/** Re-renders once the answer is in. Null while it's still being checked */
export const useWebPSupport = () =>
  useSyncExternalStore(subscribeWebPSupport, getWebPSupport, () => null);
