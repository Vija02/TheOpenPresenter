import React, { forwardRef, useImperativeHandle, useRef } from "react";

export type RenderViewHandle = {
  next: () => string | null;
  prev: () => string | null;
  goToSlide: (slideIndex: number) => void;
};

const RenderView = React.memo(
  forwardRef(
    (
      {
        src,
        onLoad,
      }: { src: string; onLoad: React.ReactEventHandler<HTMLIFrameElement> },
      ref,
    ) => {
      const iframeRef = useRef<HTMLIFrameElement>(null);

      useImperativeHandle(ref, () => {
        return {
          next: () => {
            iframeRef.current?.contentDocument?.dispatchEvent(
              new KeyboardEvent("keydown", { key: "ArrowRight", keyCode: 39 }),
            );

            return getSlideId(
              iframeRef.current?.contentWindow?.location.hash ?? "",
            );
          },
          prev: () => {
            iframeRef.current?.contentDocument?.dispatchEvent(
              new KeyboardEvent("keydown", { key: "ArrowLeft", keyCode: 37 }),
            );

            return getSlideId(
              iframeRef.current?.contentWindow?.location.hash ?? "",
            );
          },
          goToSlide: (slideIndex: number) => {
            // We use the shortcut to navigate to the slide.
            // A possible option is to use the url hash.
            // However, there is a bug for webkit that prevents this
            // https://bugs.webkit.org/show_bug.cgi?id=24578
            (slideIndex + 1)
              .toString()
              .split("")
              .map((x) => keyCodeMapping[x])
              .forEach((keyCode) => {
                iframeRef.current?.contentDocument?.dispatchEvent(
                  new KeyboardEvent("keydown", { keyCode }),
                );
              });
            iframeRef.current?.contentDocument?.dispatchEvent(
              new KeyboardEvent("keydown", { key: "Enter", keyCode: 13 }),
            );
          },
        } satisfies RenderViewHandle;
      }, []);

      return (
        <iframe
          ref={iframeRef}
          key={src}
          src={src}
          style={{ border: 0, width: "100%", height: "100%" }}
          onLoad={onLoad}
        />
      );
    },
  ),
);

const getSlideId = (hash: string) => {
  return hash.split("id.")?.[1] ?? null;
};

const keyCodeMapping: Record<string, number> = {
  "0": 48,
  "1": 49,
  "2": 50,
  "3": 51,
  "4": 52,
  "5": 53,
  "6": 54,
  "7": 55,
  "8": 56,
  "9": 57,
};

export default RenderView;
