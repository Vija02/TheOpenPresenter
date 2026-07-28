import { CSSProperties } from "react";

import { LayoutDoc } from "../schema/document";
import { FrameContext, resolveDoc } from "../template/resolve";
import { FrameData } from "../template/spans";
import { Stage, StageSizing } from "./Stage";
import { useStage } from "./StageContext";
import { ImageElementView } from "./elements/ImageElement";
import { ShapeElementView } from "./elements/ShapeElement";
import { TextElementView } from "./elements/TextElement";

export type LayoutRendererProps = {
  doc: LayoutDoc;
  data: FrameData;
  frame?: FrameContext;
  sizing?: StageSizing;
  background?: string;
  className?: string;
  style?: CSSProperties;
};

/**
 * Binds data into a document and draws it
 */
export const LayoutRenderer = ({
  doc,
  data,
  frame,
  sizing = "fill",
  background,
  className,
  style,
}: LayoutRendererProps) => (
  <Stage
    aspectRatio={doc.aspectRatio}
    fitMode={doc.fitMode}
    sizing={sizing}
    background={background}
    className={className}
    style={style}
  >
    <LayoutElements doc={doc} data={data} frame={frame} />
  </Stage>
);

const LayoutElements = ({
  doc,
  data,
  frame,
}: Pick<LayoutRendererProps, "doc" | "data" | "frame">) => {
  const metrics = useStage();
  const { elements } = resolveDoc(doc, data, frame);

  return (
    <>
      {elements.map((element) => {
        switch (element.type) {
          case "text":
            return (
              <TextElementView
                key={element.id}
                element={element}
                metrics={metrics}
              />
            );
          case "image":
            return (
              <ImageElementView
                key={element.id}
                element={element}
                metrics={metrics}
              />
            );
          case "shape":
            return (
              <ShapeElementView
                key={element.id}
                element={element}
                metrics={metrics}
              />
            );
        }
      })}
    </>
  );
};
