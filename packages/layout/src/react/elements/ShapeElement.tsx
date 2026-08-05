import { CSSProperties } from "react";

import { StageMetrics } from "../../geometry/scale";
import { ShapeElement } from "../../schema/element";
import { ElementPlacement, appearanceToCss, placementToCss } from "../css";

export type ShapeElementViewProps = {
  element: ShapeElement;
  metrics: StageMetrics;
  placement?: ElementPlacement;
};

export const ShapeElementView = ({
  element,
  metrics,
  placement = "rect",
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
        ...placementToCss(placement, element.rect, element.rotation),
        ...appearance,
        ...kindStyle,
      }}
    />
  );
};
