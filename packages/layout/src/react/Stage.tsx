import useSize from "@react-hook/size";
import { CSSProperties, ReactNode, useMemo, useState } from "react";

import { computeStageMetrics } from "../geometry/scale";
import { DEFAULT_ASPECT_RATIO } from "../schema/defaults";
import { AspectRatio, LayoutFitMode } from "../schema/document";
import { StageContext } from "./context/StageContext";

export type StageSizing = "fill" | "aspect";

export type StageProps = {
  aspectRatio?: AspectRatio;
  fitMode?: LayoutFitMode;
  /**
   * `fill` takes the full space it is given and letterboxes internally when
   * needed. For plugin renderers, which are handed an arbitrary box.
   * `aspect` sizes itself to the aspect ratio at 100% width, for editors and
   * previews, where the stage IS the visible frame.
   */
  sizing?: StageSizing;
  background?: string;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
};

/**
 * Measures its own box, turns that into `StageMetrics`,
 * and publishes it on context so descendants can resolve rects
 * and design unit scalars to px
 */
export const Stage = ({
  aspectRatio = DEFAULT_ASPECT_RATIO,
  fitMode = "fluid",
  sizing = "fill",
  background,
  className,
  style,
  children,
}: StageProps) => {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [width, height] = useSize(el);

  const metrics = useMemo(
    () =>
      computeStageMetrics({
        containerWidth: width,
        containerHeight: height,
        aspectRatio,
        fitMode,
      }),
    [width, height, aspectRatio, fitMode],
  );

  const sizingStyle: CSSProperties =
    sizing === "aspect"
      ? {
          width: "100%",
          aspectRatio: `${aspectRatio.width} / ${aspectRatio.height}`,
        }
      : { width: "100%", height: "100%" };

  return (
    <div
      ref={setEl}
      className={className ? `lay--stage ${className}` : "lay--stage"}
      style={{ ...sizingStyle, background, ...style }}
    >
      <StageContext.Provider value={metrics}>
        {metrics.boxWidth > 0 ? children : null}
      </StageContext.Provider>
    </div>
  );
};
