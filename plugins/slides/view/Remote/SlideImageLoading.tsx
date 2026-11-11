import { ReactNode, useLayoutEffect, useRef, useState } from "react";

const allImagesLoaded = (el: HTMLElement) =>
  Array.from(el.querySelectorAll("img")).every(
    (img) => img.complete && img.naturalWidth > 0,
  );

/**
 * Shows "Loading..." over the slide until every image inside it has loaded,
 * so the slide doesn't sit as an unexplained black box in the meantime.
 */
export const SlideImageLoading = ({ children }: { children: ReactNode }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(true);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const check = () => setLoaded(allImagesLoaded(el));
    check();

    // load/error don't bubble, so listen in the capture phase
    el.addEventListener("load", check, true);
    el.addEventListener("error", check, true);
    // Images get added or replaced (e.g. on retry) after the first render
    const observer = new MutationObserver(check);
    observer.observe(el, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["src", "srcset"],
    });

    return () => {
      el.removeEventListener("load", check, true);
      el.removeEventListener("error", check, true);
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={ref} className="relative h-full w-full">
      {children}
      {!loaded && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/50 text-white/40">
          <span className="text-xs">Loading...</span>
        </div>
      )}
    </div>
  );
};
