import { useCallback, useMemo } from "react";

import { ElementView } from "../react/elements/ElementView";
import { LayoutDoc } from "../schema/document";
import { FrameContext, resolveDoc } from "../template/resolve";
import { FrameData } from "../template/spans";
import { EditorItem, LayoutEditor, RectChange } from "./LayoutEditor";

type DocItem = EditorItem & {
  element: ReturnType<typeof resolveDoc>["elements"][number];
};

export type LayoutDocEditorProps = {
  doc: LayoutDoc;
  data?: FrameData;
  frame?: FrameContext;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onChange: (doc: LayoutDoc) => void;
  background?: string;
  className?: string;
};

/**
 * Edits a LayoutDoc directly, drawing each element with the same views the
 * renderer uses. Hidden elements and those dropped by `hideWhenEmpty` are
 * absent from the canvas exactly as they would be on output.
 */
export const LayoutDocEditor = ({
  doc,
  data = {},
  frame,
  selectedIds,
  onSelectionChange,
  onChange,
  background,
  className,
}: LayoutDocEditorProps) => {
  const items = useMemo<DocItem[]>(
    () =>
      resolveDoc(doc, data, frame).elements.map((element) => ({
        id: element.id,
        rect: element.rect,
        locked: element.locked,
        element,
      })),
    [doc, data, frame],
  );

  const handleChange = useCallback(
    (changes: RectChange[]) => {
      const byId = new Map(changes.map((c) => [c.id, c.rect]));
      onChange({
        ...doc,
        elements: doc.elements.map((element) => {
          const rect = byId.get(element.id);
          return rect ? { ...element, rect } : element;
        }),
      });
    },
    [doc, onChange],
  );

  return (
    <LayoutEditor
      items={items}
      aspectRatio={doc.aspectRatio}
      fitMode={doc.fitMode}
      selectedIds={selectedIds}
      onSelectionChange={onSelectionChange}
      onChange={handleChange}
      background={background}
      className={className}
      renderItem={(item) => (
        <ElementView element={item.element} placement="fill" />
      )}
    />
  );
};
