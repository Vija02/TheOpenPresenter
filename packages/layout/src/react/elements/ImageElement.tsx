import { resolveMediaUrl } from "@repo/lib";

import { StageMetrics, rectToPx } from "../../geometry/scale";
import { ImageElement } from "../../schema/element";
import { appearanceToCss } from "../css";

export type ImageElementViewProps = {
  element: ImageElement;
  metrics: StageMetrics;
};

export const ImageElementView = ({
  element,
  metrics,
}: ImageElementViewProps) => {
  const box = rectToPx(element.rect, metrics);
  const src = resolveMediaUrl(element.src);

  return (
    <div
      style={{
        position: "absolute",
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
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
