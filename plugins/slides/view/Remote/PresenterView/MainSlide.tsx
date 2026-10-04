import useSize from "@react-hook/size";
import { CSSProperties, useMemo, useState } from "react";

import type { ResolvedSlide } from "../../../src/types";
import Renderer from "../../Renderer";
import { MirrorRendererData } from "./MirrorRendererData";
import {
  aspectRatioCss,
  aspectRatioValue,
  slideAspectRatio,
} from "./slideGeometry";

export const MainSlide = ({ slide }: { slide: ResolvedSlide | null }) => {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const [containerWidth, containerHeight] = useSize(element);

  const aspectRatio = slideAspectRatio(slide);
  const ratio = aspectRatioValue(aspectRatio);
  const aspectCss = aspectRatioCss(aspectRatio);

  const boxStyle = useMemo<CSSProperties>(() => {
    if (containerWidth <= 0 || containerHeight <= 0) {
      return { width: "100%", aspectRatio: aspectCss };
    }

    let width = containerWidth;
    let height = width / ratio;
    if (height > containerHeight) {
      height = containerHeight;
      width = height * ratio;
    }
    return { width, height };
  }, [containerWidth, containerHeight, ratio, aspectCss]);

  return (
    <div
      ref={setElement}
      className="flex min-h-0 w-full min-w-0 shrink items-center justify-center overflow-auto"
      style={{ aspectRatio: aspectCss }}
    >
      <div
        data-testid="speaker-main-box"
        className="relative shrink-0 overflow-hidden bg-black"
        style={boxStyle}
      >
        {slide ? (
          // Google's embed draws the slide ~2px short of its frame on the right
          // and bottom, showing its black page there. Oversize the frame and
          // let the box clip the strip.
          <div className="pointer-events-none absolute left-0 top-0 h-[calc(100%+2px)] w-[calc(100%+2px)]">
            <MirrorRendererData>
              <Renderer />
            </MirrorRendererData>
          </div>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-tertiary">
            Nothing to show
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-stroke" />
      </div>
    </div>
  );
};
