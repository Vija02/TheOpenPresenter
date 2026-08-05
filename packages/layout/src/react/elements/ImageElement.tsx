import { resolveMediaUrl } from "@repo/lib";

import { StageMetrics } from "../../geometry/scale";
import { ImageElement } from "../../schema/element";
import { ElementPlacement, appearanceToCss, placementToCss } from "../css";

export type ImageElementViewProps = {
  element: ImageElement;
  metrics: StageMetrics;
  placement?: ElementPlacement;
};

export const ImageElementView = ({
  element,
  metrics,
  placement = "rect",
}: ImageElementViewProps) => {
  const src = resolveMediaUrl(element.src);

  return (
    <div
      style={{
        ...placementToCss(placement, element.rect, element.rotation),
        ...appearanceToCss(element, metrics),
      }}
    >
      {src ? (
        <img
          src={src}
          alt=""
          draggable={false}
          style={{
            width: "100%",
            height: "100%",
            objectFit: element.fit,
            display: "block",
          }}
        />
      ) : null}
    </div>
  );
};
