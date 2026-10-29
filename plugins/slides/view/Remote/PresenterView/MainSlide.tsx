import useSize from "@react-hook/size";
import { CSSProperties, ReactNode, useMemo, useState } from "react";

import type { ResolvedSlide } from "../../../src/types";
import Renderer from "../../Renderer";
import { MirrorRendererData } from "./MirrorRendererData";
import {
  aspectRatioCss,
  aspectRatioValue,
  slideAspectRatio,
} from "./slideGeometry";

export const MainSlide = ({
  slide,
  overlay,
}: {
  slide: ResolvedSlide | null;
  overlay?: ReactNode;
}) => {
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
        className="relative shrink-0 select-none overflow-hidden bg-black"
        style={boxStyle}
      >
        {slide ? (
          <div className="pointer-events-none absolute inset-0">
            <MirrorRendererData>
              <Renderer />
            </MirrorRendererData>
          </div>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-tertiary">
            Nothing to show
          </div>
        )}
        {slide && overlay}
        <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-stroke" />
      </div>
    </div>
  );
};
