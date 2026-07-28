import { CSSProperties } from "react";

import { StageMetrics, rectToPx } from "../../geometry/scale";
import { ShapeElement } from "../../schema/element";
import { appearanceToCss } from "../css";

export type ShapeElementViewProps = {
  element: ShapeElement;
  metrics: StageMetrics;
};

export const ShapeElementView = ({
  element,
  metrics,
}: ShapeElementViewProps) => {
  const box = rectToPx(element.rect, metrics);
  const appearance = appearanceToCss(element, metrics);

  const kindStyle: CSSProperties =
    element.kind === "ellipse"
      ? { borderRadius: "50%" }
      : element.kind === "line"
        ? { height: 0 }
        : {};

  return (
    <div
      style={{
        position: "absolute",
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
        ...appearance,
        ...kindStyle,
      }}
    />
  );
};
