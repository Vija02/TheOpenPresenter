/**
 * Messages from sign-in popups. The popup can report back before the effect
 * that listens for it has run, so recent ones are kept and replayed to
 * listeners that start late.
 */
const recent: MessageEvent[] = [];
const KEEP = 20;

window.addEventListener("message", (event) => {
  recent.push(event);
  if (recent.length > KEEP) recent.shift();
});

/** `performance.now()` when a popup is opened, to pass to `listenToPopup`. */
export const popupOpenedAt = () => performance.now();

/**
 * Calls `handler` with every message since `openedAt`, including ones that
 * arrived before this was called. Returns a function to stop listening.
 */
export const listenToPopup = (
  openedAt: number,
  handler: (event: MessageEvent) => void,
) => {
  for (const event of recent.filter((e) => e.timeStamp >= openedAt)) {
    handler(event);
  }
  window.addEventListener("message", handler);
  return () => window.removeEventListener("message", handler);
};
