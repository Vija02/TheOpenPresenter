import { LayoutDoc } from "../../../schema/document";
import { LayoutElement, TextElement } from "../../../schema/element";

export type SectionProps<E extends LayoutElement = LayoutElement> = {
  doc: LayoutDoc;
  element: E;
  onChange: (doc: LayoutDoc) => void;
};

/** Sections that only render for text elements. */
export type TextSectionProps = SectionProps<TextElement>;
