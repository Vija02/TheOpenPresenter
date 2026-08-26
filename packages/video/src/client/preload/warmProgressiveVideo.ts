/** Warms a progressive video file by decoding its first frames in a detached element */
// DEBT: This is not very well tested. But it's also not a workflow we expect
export const warmProgressiveVideo = (url: string, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const element = document.createElement("video");

    const cleanup = () => {
      signal.removeEventListener("abort", onAbort);
      element.removeEventListener("loadeddata", onLoaded);
      element.removeEventListener("error", onError);
      // Detaching the source stops any in flight buffering
      element.removeAttribute("src");
      element.load();
    };

    const onLoaded = () => {
      cleanup();
      resolve();
    };

    const onError = () => {
      cleanup();
      reject(new Error(`Preload failed to load ${url}`));
    };

    const onAbort = () => {
      cleanup();
      reject(new DOMException("Aborted", "AbortError"));
    };

    element.addEventListener("loadeddata", onLoaded);
    element.addEventListener("error", onError);
    signal.addEventListener("abort", onAbort);

    element.preload = "auto";
    element.muted = true;
    element.src = url;
    element.load();
  });
