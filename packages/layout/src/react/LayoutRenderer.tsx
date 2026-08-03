import { CSSProperties, useEffect } from "react";

import { LayoutDoc } from "../schema/document";
import { FrameContext, ResolvedElement, resolveDoc } from "../template/resolve";
import { FrameData } from "../template/spans";
import { Stage, StageSizing } from "./Stage";
import { ElementView } from "./elements/ElementView";
import { ensureFontsLoaded } from "./text/fontStatus";

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

const collectFontStacks = (elements: ResolvedElement[]): string[] => {
  const stacks = new Set<string>();
  for (const element of elements) {
    if (element.type !== "text") continue;
    if (element.style.fontFamily) stacks.add(element.style.fontFamily);
    for (const role of Object.values(element.spanRoles ?? {})) {
      if (role?.fontFamily) stacks.add(role.fontFamily);
    }
  }
  return [...stacks];
};

const LayoutElements = ({
  doc,
  data,
  frame,
}: Pick<LayoutRendererProps, "doc" | "data" | "frame">) => {
  const { elements } = resolveDoc(doc, data, frame);

  // Preload the bundled faces this document uses
  const fontKey = collectFontStacks(elements).join("\n");
  useEffect(() => {
    ensureFontsLoaded(fontKey.split("\n").filter(Boolean));
  }, [fontKey]);

  return (
    <>
      {elements.map((element) => (
        <ElementView key={element.id} element={element} />
      ))}
    </>
  );
};
