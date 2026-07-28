import { resolveMediaUrl } from "@repo/lib";

import { StageMetrics } from "../../geometry/scale";
import { ImageElement } from "../../schema/element";
import { appearanceToCss, rectToCss } from "../css";

export type ImageElementViewProps = {
  element: ImageElement;
  metrics: StageMetrics;
};

export const ImageElementView = ({
  element,
  metrics,
}: ImageElementViewProps) => {
  const src = resolveMediaUrl(element.src);

  return (
    <div
      style={{
        ...rectToCss(element.rect),
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
