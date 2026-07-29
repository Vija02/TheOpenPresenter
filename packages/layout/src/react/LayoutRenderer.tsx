import { CSSProperties } from "react";

import { LayoutDoc } from "../schema/document";
import { FrameContext, resolveDoc } from "../template/resolve";
import { FrameData } from "../template/spans";
import { Stage, StageSizing } from "./Stage";
import { ElementView } from "./elements/ElementView";

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
  const { elements } = resolveDoc(doc, data, frame);
  return (
    <>
      {elements.map((element) => (
        <ElementView key={element.id} element={element} />
      ))}
    </>
  );
};
