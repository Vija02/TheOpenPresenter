import { OutputVolume } from "@repo/base-plugin";

/**
 * Host-level output level for this renderer.
 */
export const PREVIEW_MUTE_MESSAGE = "preview:setMuted";

const subscribers = new Set<() => void>();

const startsMuted =
  new URLSearchParams(window.location.search).get("preview") === "1";

let scale = startsMuted ? 0 : 1;

export const outputVolume: OutputVolume = {
  get scale() {
    return scale;
  },
  subscribe: (callback) => {
    subscribers.add(callback);
    return () => {
      subscribers.delete(callback);
    };
  },
};

const setScale = (next: number) => {
  if (next === scale) return;
  scale = next;
  subscribers.forEach((callback) => callback());
};

/** Lets the preview window mute and unmute this renderer after load. */
export const listenForOutputVolumeChanges = () => {
  window.addEventListener("message", (event) => {
    if (event.origin !== window.location.origin) return;
    if (event.data?.type !== PREVIEW_MUTE_MESSAGE) return;

    setScale(event.data.muted ? 0 : 1);
  });
};
