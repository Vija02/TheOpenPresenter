import { LayoutDoc, cloneDoc } from "@repo/layout";
import { CheckField, LayoutWorkbench } from "@repo/layout/editor";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  useOverlayToggle,
} from "@repo/ui";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  bibleBindings,
  bibleTemplates,
  defaultBibleTemplate,
  findTemplate,
  resolveBibleDoc,
} from "../../src/template/presets";
import { passageToFrame } from "../../src/template/toFrame";
import { BiblePassage } from "../../src/types";
import { usePluginAPI } from "../pluginApi";

const PREVIEW_PASSAGE: BiblePassage = {
  id: "preview",
  reference: "John 3:16",
  translationId: "web",
  translationName: "World English Bible",
  verses: [
    {
      bookId: "JHN",
      bookName: "John",
      chapter: 3,
      verse: 16,
      text: "For God so loved the world, that he gave his one and only Son, that whoever believes in him should not perish, but have eternal life.",
    },
  ],
};

const StyleModal = () => {
  const { isOpen, onToggle } = useOverlayToggle();
  const pluginApi = usePluginAPI();
  const mutableSceneData = pluginApi.scene.useValtioData();
  const savedTemplate = pluginApi.scene.useData((x) => x.pluginData.template);
  const savedShowVerseNumbers = pluginApi.scene.useData(
    (x) => x.pluginData.showVerseNumbers,
  );

  // Staged locally and committed on Save
  const [doc, setDoc] = useState<LayoutDoc>(() =>
    cloneDoc(resolveBibleDoc(savedTemplate)),
  );
  const [showVerseNumbers, setShowVerseNumbers] = useState(
    savedShowVerseNumbers ?? false,
  );
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);

  useEffect(() => {
    setDoc(cloneDoc(resolveBibleDoc(savedTemplate)));
    setShowVerseNumbers(savedShowVerseNumbers ?? false);
    setActiveTemplateId(null);
  }, [savedTemplate, savedShowVerseNumbers]);

  // Sample bindings, so canvas and thumbnails show verses not tokens.
  const data = useMemo(
    () => passageToFrame(PREVIEW_PASSAGE, 0, { showVerseNumbers }),
    [showVerseNumbers],
  );

  const onSelectTemplate = useCallback((templateId: string) => {
    const template = findTemplate(templateId);
    if (!template) return;
    const ok = window.confirm(
      `Replace the current layout with "${template.name}"? Any elements you have moved or resized will be lost.`,
    );
    if (!ok) return;
    setDoc(cloneDoc(template.doc));
    setActiveTemplateId(templateId);
  }, []);

  const onSave = () => {
    // cloneDoc also strips `undefined`
    mutableSceneData.pluginData.template = cloneDoc(doc);
    mutableSceneData.pluginData.showVerseNumbers = showVerseNumbers;
    onToggle?.();
  };

  const onReset = () => {
    const fallback = defaultBibleTemplate();
    setDoc(cloneDoc(fallback.doc));
    setShowVerseNumbers(false);
    setActiveTemplateId(fallback.id);
  };

  return (
    <Dialog open={isOpen ?? false} onOpenChange={onToggle ?? (() => {})}>
      <DialogContent
        size="full"
        className="desktop:w-[96vw] desktop:max-w-[1400px] desktop:h-[88vh] flex flex-col p-0 gap-0"
      >
        <DialogHeader className="px-4 py-3 border-b border-stroke shrink-0">
          <DialogTitle>Slide Template</DialogTitle>
        </DialogHeader>

        <DialogBody className="flex-1 min-h-0 p-0 overflow-hidden">
          <LayoutWorkbench
            doc={doc}
            onChange={setDoc}
            data={data}
            templates={bibleTemplates}
            activeTemplateId={activeTemplateId}
            onSelectTemplate={onSelectTemplate}
            bindings={bibleBindings}
            aiThreadKey={`bible:${pluginApi.pluginContext.pluginId}`}
            pluginApi={pluginApi}
            documentExtras={
              <CheckField
                label="Show verse numbers"
                checked={showVerseNumbers}
                onChange={setShowVerseNumbers}
              />
            }
          />
        </DialogBody>

        <DialogFooter className="px-4 py-3 border-t border-stroke shrink-0">
          <div className="stack-row justify-between w-full">
            <Button variant="outline" onClick={onReset}>
              Reset
            </Button>
            <div className="stack-row">
              <Button variant="outline" onClick={() => onToggle?.()}>
                Cancel
              </Button>
              <Button variant="success" onClick={onSave}>
                Save
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default StyleModal;
