import { CSSProperties } from "react";

import { StageMetrics } from "../../geometry/scale";
import { ShapeElement } from "../../schema/element";
import { appearanceToCss, rectToCss } from "../css";

export type ShapeElementViewProps = {
  element: ShapeElement;
  metrics: StageMetrics;
};

export const ShapeElementView = ({
  element,
  metrics,
}: ShapeElementViewProps) => {
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
        ...rectToCss(element.rect),
        ...appearance,
        ...kindStyle,
      }}
    />
  );
};
