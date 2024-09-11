import React, { forwardRef, useImperativeHandle, useRef } from "react";

export type RenderViewHandle = {
  next: () => string | null;
  prev: () => string | null;
  goToSlide: (slideId: string) => void;
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
          goToSlide: (slideId: string) => {
            if (iframeRef.current?.contentWindow?.location.hash) {
              iframeRef.current.contentWindow.location.hash =
                "#slide=id." + slideId;
            }
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

export default RenderView;
