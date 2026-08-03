import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";

import { findElement } from "../doc/edit";
import { DataBinding, LayoutDoc, Template } from "../schema/document";
import { FrameContext } from "../template/resolve";
import { FrameData } from "../template/spans";
import { LayoutDocEditor } from "./LayoutDocEditor";
import { TemplateRail } from "./TemplateRail";
import { DocumentInspector } from "./inspector/DocumentInspector";
import { ElementInspector } from "./inspector/ElementInspector";

export type LayoutWorkbenchProps = {
  doc: LayoutDoc;
  onChange: (doc: LayoutDoc) => void;
  /** Sample bindings for the canvas and the rail thumbnails. */
  data?: FrameData;
  frame?: FrameContext;

  /** Omit to hide the template rail entirely. */
  templates?: Template[];
  activeTemplateId?: string | null;
  onSelectTemplate?: (templateId: string) => void;

  /** Tokens offered as insert chips in the Content section. */
  bindings?: DataBinding[];

  /** Plugin-specific document controls (things that are data, not layout). */
  documentExtras?: ReactNode;
  className?: string;
};

/**
 * The full editing surface: template rail, canvas, contextual inspector.
 * Expects a fixed height from the parent
 */
export const LayoutWorkbench = ({
  doc,
  onChange,
  data = {},
  frame,
  templates,
  activeTemplateId = null,
  onSelectTemplate,
  bindings = [],
  documentExtras,
  className,
}: LayoutWorkbenchProps) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Applying a template or deleting a layer can strip ids out from under the
  // selection, leaving the inspector keyed off a ghost.
  useEffect(() => {
    setSelectedIds((prev) => {
      const alive = prev.filter((id) => findElement(doc, id) !== null);
      return alive.length === prev.length ? prev : alive;
    });
  }, [doc]);

  const selected = useMemo(
    () =>
      selectedIds.length === 1 && selectedIds[0]
        ? findElement(doc, selectedIds[0])
        : null,
    [doc, selectedIds],
  );

  const clearSelection = useCallback(() => setSelectedIds([]), []);

  return (
    <div className={`flex h-full min-h-0 ${className ?? ""}`}>
      {templates && templates.length > 0 && onSelectTemplate && (
        <aside className="w-[170px] shrink-0 border-r border-stroke overflow-y-auto p-3">
          <TemplateRail
            templates={templates}
            data={data}
            activeId={activeTemplateId}
            onSelect={onSelectTemplate}
          />
        </aside>
      )}

      <main
        className="lay--workbench-canvas flex-1 min-w-0 min-h-0 flex items-center justify-center p-6 overflow-hidden"
        onPointerDown={(e) => {
          if (!(e.target as HTMLElement).closest(".lay--editor")) {
            clearSelection();
          }
        }}
      >
        {/* Stage is width:100% + aspect-ratio, so this must be WIDTH-constrained to fit a fixed height */}
        <div
          className="max-w-full flex items-center"
          style={{
            height: "100%",
            aspectRatio: `${doc.aspectRatio.width} / ${doc.aspectRatio.height}`,
          }}
        >
          <LayoutDocEditor
            doc={doc}
            data={data}
            frame={frame}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            onChange={onChange}
            className="w-full"
          />
        </div>
      </main>

      <aside className="w-[280px] shrink-0 border-l border-stroke overflow-y-auto px-3">
        {selectedIds.length > 1 ? (
          <p className="text-xs text-secondary py-2">
            {selectedIds.length} elements selected. Drag to move them together,
            or select one to edit its properties.
          </p>
        ) : selected ? (
          <ElementInspector
            doc={doc}
            element={selected}
            onChange={onChange}
            onSelectionChange={setSelectedIds}
            bindings={bindings}
          />
        ) : (
          <DocumentInspector doc={doc} onChange={onChange}>
            {documentExtras}
          </DocumentInspector>
        )}
      </aside>
    </div>
  );
};
