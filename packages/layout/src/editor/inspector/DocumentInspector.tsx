import { ReactNode } from "react";

import { LayoutDoc } from "../../schema/document";
import { Section } from "./primitives";

export type DocumentInspectorProps = {
  doc: LayoutDoc;
  onChange: (doc: LayoutDoc) => void;
  /** Extra controls*/
  children?: ReactNode;
  hint?: string;
};

export const DocumentInspector = ({
  children,
  hint = "Click an element on the canvas to edit it. Drag to move, drag a corner to resize, arrow keys to nudge.",
}: DocumentInspectorProps) => (
  <>
    <p className="text-xs text-secondary py-2">{hint}</p>

    {children && <Section title="Slide">{children}</Section>}
  </>
);
