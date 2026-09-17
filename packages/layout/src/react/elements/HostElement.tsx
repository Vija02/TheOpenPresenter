import { StageMetrics, rectToPx } from "../../geometry/scale";
import { HostElement, HostSource } from "../../schema/element";
import { useHostRenderer } from "../context/HostContext";
import { ElementPlacement, appearanceToCss, placementToCss } from "../css";
import { FillLayer } from "./FillLayer";
import { HostElementFrame } from "./HostElementFrame";

export type HostElementViewProps = {
  element: HostElement;
  metrics: StageMetrics;
  placement?: ElementPlacement;
};

export const hostSourceLabel = (source: HostSource): string => {
  switch (source.kind) {
    case "screen":
      return `Screen ${source.rendererId}`;
    case "scene":
      return "Scene";
    case "plugin":
      return "Plugin";
  }
};

export const HostElementView = ({
  element,
  metrics,
  placement = "rect",
}: HostElementViewProps) => {
  const renderHost = useHostRenderer();

  return (
    <div
      data-lay-host={element.source.kind}
      style={{
        ...placementToCss(placement, element.rect, element.rotation),
        isolation: "isolate",
        ...appearanceToCss(element, metrics),
      }}
    >
      <FillLayer
        fill={element.fill}
        width={rectToPx(element.rect, metrics).width}
        elementId={element.id}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          borderRadius: "inherit",
          overflow: "hidden",
        }}
      >
        {renderHost ? (
          renderHost({ element })
        ) : (
          <HostElementFrame element={element} />
        )}
      </div>
    </div>
  );
};
