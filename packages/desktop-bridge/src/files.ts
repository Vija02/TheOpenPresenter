/** Linking slides to files on this computer. Studio only. */

const bridge = () =>
  typeof window === "undefined"
    ? null
    : (window.theOpenPresenterDesktop ?? null);

/** A file's path on disk, or null outside Studio */
export const getPathForFile = (file: File): string | null =>
  bridge()?.getPathForFile?.(file) || null;

/** This install's iroh endpoint id, or null outside Studio */
export const getNodeId = async (): Promise<string | null> =>
  (await bridge()
    ?.nodeId?.()
    .catch(() => null)) ?? null;

// Studio keeps one list per page, so every caller's paths go in it together
const watchers = new Set<{
  filePaths: string[];
  onChanged: (filePath: string) => void;
}>();
let stopListening: (() => void) | null = null;

const sendWatchList = () => {
  const b = bridge();
  if (!b?.watchLinkedFiles) return;
  void b.watchLinkedFiles([
    ...new Set([...watchers].flatMap((w) => w.filePaths)),
  ]);

  if (watchers.size > 0 && !stopListening) {
    stopListening = b.on("linked-files:changed", (filePath) => {
      if (typeof filePath !== "string") return;
      for (const w of watchers) {
        if (w.filePaths.includes(filePath)) w.onChanged(filePath);
      }
    });
  } else if (watchers.size === 0) {
    stopListening?.();
    stopListening = null;
  }
};

/**
 * Calls `onChanged` after each save settles, and once at the start. Returns a
 * stop function.
 */
export const watchLinkedFiles = (
  filePaths: string[],
  onChanged: (filePath: string) => void,
): (() => void) => {
  const watcher = { filePaths, onChanged };
  watchers.add(watcher);
  sendWatchList();
  return () => {
    watchers.delete(watcher);
    sendWatchList();
  };
};

export const readLinkedFile = (filePath: string): Promise<Uint8Array> => {
  const read = bridge()?.readLinkedFile;
  if (!read) return Promise.reject(new Error("Only Studio can read files."));
  return read(filePath);
};
