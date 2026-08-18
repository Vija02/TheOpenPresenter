import {
  AiChat,
  AiChatPluginApi,
  AiChatRequest,
  createAiCapabilityRequest,
  useAiChat,
} from "@repo/ai-chat";
import { appData } from "@repo/lib";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui";
import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";

import { findElement } from "../doc/edit";
import { DataBinding, LayoutDoc, Template } from "../schema/document";
import { FrameContext } from "../template/resolve";
import { FrameData } from "../template/spans";
import { AddElementBar } from "./AddElementBar";
import { LayoutDocEditor } from "./LayoutDocEditor";
import { TemplateRail } from "./TemplateRail";
import { DocumentInspector } from "./inspector/DocumentInspector";
import { ElementInspector } from "./inspector/ElementInspector";
import { LayoutPluginApi } from "./pluginApi";
import { useIsCompact } from "./useMediaQuery";

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

  hideAddElements?: boolean;

  /** On by default */
  ai?: boolean;
  /** Point at a plugin's own capability instead of the platform default. */
  aiCapability?: string;
  /** Escape hatch: run the edit yourself */
  onRequestAiEdit?: AiChatRequest<LayoutDoc>;
  aiThreadKey?: string;
  /** Supply an already-built chat */
  aiChat?: AiChat;
  /** Powers the AI chat and the inspector's image picker. */
  pluginApi?: AiChatPluginApi & LayoutPluginApi;
  className?: string;
};

type CompactTab = "templates" | "properties";

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
  hideAddElements = false,
  ai: aiEnabled = true,
  aiCapability = "layout",
  onRequestAiEdit,
  aiThreadKey = "default",
  aiChat,
  pluginApi,
  className,
}: LayoutWorkbenchProps) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const compact = useIsCompact();
  const [compactTab, setCompactTab] = useState<CompactTab>("properties");

  const aiRequest = useMemo(() => {
    if (!aiEnabled || aiChat) return undefined;
    if (onRequestAiEdit) return onRequestAiEdit;
    return appData.getAiEnabled()
      ? createAiCapabilityRequest<LayoutDoc>({ capability: aiCapability })
      : undefined;
  }, [onRequestAiEdit, aiEnabled, aiCapability, aiChat]);

  const ownAi = useAiChat<LayoutDoc>({
    doc,
    onChange,
    onRequest: aiRequest,
    threadKey: aiThreadKey,
    pluginApi,
  });

  const ai = aiChat ?? (aiRequest ? ownAi : undefined);

  // Applying a template or deleting a layer can strip ids out from under the
  // selection, leaving the inspector keyed off a ghost.
  useEffect(() => {
    setSelectedIds((prev) => {
      const alive = prev.filter((id) => findElement(doc, id) !== null);
      return alive.length === prev.length ? prev : alive;
    });
  }, [doc]);

  // On a phone the inspector is behind a tab, so selecting an element would
  // otherwise appear to do nothing at all.
  useEffect(() => {
    if (compact && selectedIds.length > 0) setCompactTab("properties");
  }, [compact, selectedIds]);

  const selected = useMemo(
    () =>
      selectedIds.length === 1 && selectedIds[0]
        ? findElement(doc, selectedIds[0])
        : null,
    [doc, selectedIds],
  );

  const clearSelection = useCallback(() => setSelectedIds([]), []);

  const rail =
    templates && templates.length > 0 && onSelectTemplate ? (
      <TemplateRail
        templates={templates}
        data={data}
        activeId={activeTemplateId}
        onSelect={onSelectTemplate}
        title={compact ? null : undefined}
        columns={compact ? 2 : 1}
      />
    ) : null;

  const inspector =
    selectedIds.length > 1 ? (
      <p className="text-xs text-secondary py-2">
        {selectedIds.length} elements selected. Drag to move them together, or
        select one to edit its properties.
      </p>
    ) : selected ? (
      <ElementInspector
        doc={doc}
        element={selected}
        onChange={onChange}
        onSelectionChange={setSelectedIds}
        bindings={bindings}
        pluginApi={pluginApi}
      />
    ) : (
      <DocumentInspector doc={doc} onChange={onChange} ai={ai}>
        {documentExtras}
      </DocumentInspector>
    );

  const stageAspect = `${doc.aspectRatio.width} / ${doc.aspectRatio.height}`;

  const canvasPadding = !hideAddElements
    ? compact
      ? "px-2 pb-2 pt-12"
      : "px-6 pb-6 pt-16"
    : compact
      ? "p-2"
      : "p-6";

  const canvas = (
    <main
      className={
        (compact
          ? "lay--workbench-canvas relative w-full shrink-0 max-h-[55%] flex items-center justify-center overflow-hidden "
          : "lay--workbench-canvas relative flex-1 min-w-0 min-h-0 flex items-center justify-center overflow-hidden ") +
        canvasPadding
      }
      style={compact ? { aspectRatio: stageAspect } : undefined}
      onPointerDown={(e) => {
        if (!(e.target as HTMLElement).closest(".lay--editor")) {
          clearSelection();
        }
      }}
    >
      {/* Stage is width:100% + aspect-ratio, so this must be WIDTH-constrained to fit a fixed height */}
      <div
        className="max-w-full flex items-center"
        style={{ height: "100%", aspectRatio: stageAspect }}
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

      {!hideAddElements && (
        <AddElementBar
          doc={doc}
          onChange={onChange}
          onSelectionChange={setSelectedIds}
          pluginApi={pluginApi}
          className="absolute top-2 left-1/2 z-10 -translate-x-1/2 max-w-[calc(100%-1rem)] overflow-x-auto"
        />
      )}
    </main>
  );

  if (compact) {
    return (
      <div className={`flex flex-col h-full min-h-0 ${className ?? ""}`}>
        {canvas}

        {rail ? (
          <Tabs
            value={compactTab}
            onValueChange={(value) => setCompactTab(value as CompactTab)}
            className="flex-1 min-h-0 flex flex-col border-t border-stroke"
          >
            <TabsList className="shrink-0">
              <TabsTrigger value="properties">Properties</TabsTrigger>
              <TabsTrigger value="templates">Templates</TabsTrigger>
            </TabsList>
            {/* Radix unmounts the inactive panel, so each pane stays a single instance. */}
            <TabsContent
              value="properties"
              className="flex-1 min-h-0 overflow-y-auto px-3"
            >
              {inspector}
            </TabsContent>
            <TabsContent
              value="templates"
              className="flex-1 min-h-0 overflow-y-auto p-3"
            >
              {rail}
            </TabsContent>
          </Tabs>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto px-3 border-t border-stroke">
            {inspector}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`flex h-full min-h-0 ${className ?? ""}`}>
      {rail && (
        <aside className="w-[170px] shrink-0 border-r border-stroke overflow-y-auto p-3">
          {rail}
        </aside>
      )}

      {canvas}

      <aside className="w-[280px] shrink-0 border-l border-stroke overflow-y-auto px-3">
        {inspector}
      </aside>
    </div>
  );
};
