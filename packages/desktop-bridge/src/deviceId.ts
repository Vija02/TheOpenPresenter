import { newWindowId as randomId } from "./web/presentChannel";

const KEY = "top-device-id";

let cached: string | null = null;

/** Shared by this browser profile's remotes and windows */
export const getDeviceId = (): string => {
  if (cached) return cached;
  try {
    cached = localStorage.getItem(KEY);
    if (!cached) {
      cached = randomId();
      localStorage.setItem(KEY, cached);
    }
  } catch {
    cached = randomId();
  }
  return cached;
};
