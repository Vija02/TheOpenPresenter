import { useCallback, useEffect, useMemo, useState } from "react";

import { patchTextElement } from "../doc/edit";
import { ElementView } from "../react/elements/ElementView";
import { LayoutDoc } from "../schema/document";
import { FrameContext, resolveDoc } from "../template/resolve";
import { FrameData } from "../template/spans";
import { EditorItem, LayoutEditor, RectChange } from "./LayoutEditor";
import { TextEditOverlay } from "./TextEditOverlay";

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
  const [editingId, setEditingId] = useState<string | null>(null);

  const items = useMemo<DocItem[]>(
    () =>
      resolveDoc(doc, data, frame).elements.map((element) => ({
        id: element.id,
        rect: element.rect,
        rotation: element.rotation,
        locked: element.locked,
        element,
      })),
    [doc, data, frame],
  );

  /** The raw source for the element being edited. */
  const editingContent = useMemo(() => {
    if (!editingId) return null;
    const element = doc.elements.find((e) => e.id === editingId);
    return element?.type === "text" ? element.content : null;
  }, [doc, editingId]);

  // Applying a template can drop the element mid-edit, which would otherwise
  // leave the overlay bound to an id that no longer exists.
  useEffect(() => {
    if (editingId && editingContent === null) setEditingId(null);
  }, [editingId, editingContent]);

  const handleChange = useCallback(
    (changes: RectChange[]) => {
      const byId = new Map(changes.map((c) => [c.id, c]));
      onChange({
        ...doc,
        elements: doc.elements.map((element) => {
          const change = byId.get(element.id);
          if (!change) return element;
          return {
            ...element,
            rect: change.rect,
            // Absent means the gesture never touched the angle.
            ...(change.rotation === undefined
              ? {}
              : { rotation: change.rotation }),
          };
        }),
      });
    },
    [doc, onChange],
  );

  const handleDoubleClick = useCallback(
    (id: string) => {
      const element = doc.elements.find((e) => e.id === id);
      // Only edit for text
      if (element?.type === "text") setEditingId(id);
    },
    [doc],
  );

  const commit = useCallback(
    (value: string) => {
      if (!editingId) return;
      setEditingId(null);
      if (value === editingContent) return;
      onChange(patchTextElement(doc, editingId, { content: value }));
    },
    [doc, editingId, editingContent, onChange],
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
      editingId={editingId}
      onItemDoubleClick={handleDoubleClick}
      renderItem={(item) =>
        item.id === editingId &&
        editingContent !== null &&
        item.element.type === "text" ? (
          <TextEditOverlay
            element={item.element}
            value={editingContent}
            onCommit={commit}
            onCancel={() => setEditingId(null)}
          />
        ) : (
          <ElementView element={item.element} placement="fill" />
        )
      }
    />
  );
};
