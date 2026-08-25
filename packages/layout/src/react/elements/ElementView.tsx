import { ResolvedElement } from "../../template/resolve";
import { useStage } from "../context/StageContext";
import { ElementPlacement } from "../css";
import { ShapeElementView } from "./ShapeElement";
import { TextElementView } from "./TextElement";

export type ElementViewProps = {
  element: ResolvedElement;
  placement?: ElementPlacement;
};

/** Single dispatch point, so the renderer and the editor draw identically. */
export const ElementView = ({ element, placement }: ElementViewProps) => {
  const metrics = useStage();

  switch (element.type) {
    case "text":
      return (
        <TextElementView
          element={element}
          metrics={metrics}
          placement={placement}
        />
      );
    case "shape":
      return (
        <ShapeElementView
          element={element}
          metrics={metrics}
          placement={placement}
        />
      );
  }
};
