import { LayoutDoc } from "@repo/layout";
import { LayoutInsertDefaults, LayoutWorkbench } from "@repo/layout/editor";
import { appData } from "@repo/lib";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@repo/ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  customSlideTemplates,
  findCustomSlideTemplate,
} from "../../../src/template/presets";
import { usePluginAPI } from "../../pluginApi";
import { LayoutPicker } from "./LayoutPicker";
import { SlideFilmstrip } from "./SlideFilmstrip";
import { useCustomSlides, useDeckSlides } from "./useCustomSlides";
import { useDeckAi } from "./useDeckAi";

const AI_ENABLED = appData.getAiEnabled();

const EMPTY_DATA = {};

const INSERT_DEFAULTS: LayoutInsertDefaults = {
  fills: { video: { playback: "once" } },
};

type SideTab = "slides" | "layouts";

export type CustomSlideEditorModalProps = {
  importId: string;
  initialSlideIndex?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const CustomSlideEditorModal = ({
  importId,
  initialSlideIndex = 0,
  open,
  onOpenChange,
}: CustomSlideEditorModalProps) => {
  const pluginApi = usePluginAPI();
  const totalSceneSlides = pluginApi.scene.useData(
    (x) => x.pluginData.slideOrder?.length ?? 0,
  );

  const slides = useDeckSlides(importId);
  const { addSlide, duplicateSlide, updateSlideDoc, removeSlide, moveSlide } =
    useCustomSlides();

  const [selectedSlideIndex, setSelectedSlideIndex] =
    useState<number>(initialSlideIndex);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [sideTab, setSideTab] = useState<SideTab>("slides");

  const selectedSlide = useMemo(
    () => slides.find((s) => s.slideIndex === selectedSlideIndex) ?? null,
    [slides, selectedSlideIndex],
  );

  const deckPosition = useMemo(() => {
    const at = slides.findIndex((s) => s.slideIndex === selectedSlideIndex);
    return at === -1 ? null : at;
  }, [slides, selectedSlideIndex]);

  const deckPositionRef = useRef(deckPosition);
  deckPositionRef.current = deckPosition;
  const slideCountRef = useRef(slides.length);
  slideCountRef.current = slides.length;

  const getAiContext = useCallback(() => {
    const index = deckPositionRef.current;
    const count = slideCountRef.current;
    if (index == null) return null;
    return `The user is currently editing slide ${index + 1} of ${count}. Always refer to it as "slide ${index + 1}" when you talk to the user, and this is the slide they mean by "this slide" or "the current slide". (Internal detail: that slide is zero-based index ${index}; list_slides/get_slide/edit_slide take zero-based indices, so use index ${index} in tool calls.)`;
  }, []);

  const deckAi = useDeckAi(importId, { getContext: getAiContext });

  // Handle if slide vanish. Eg: Another person deleting
  useEffect(() => {
    if (slides.length === 0) return;
    if (slides.some((s) => s.slideIndex === selectedSlideIndex)) return;
    setSelectedSlideIndex(slides[0]!.slideIndex);
  }, [slides, selectedSlideIndex]);

  // Deleting the last slide removes the deck itself
  useEffect(() => {
    if (open && slides.length === 0) onOpenChange(false);
  }, [open, slides.length, onOpenChange]);

  // Make sure that selection is updated when we append from outside
  useEffect(() => {
    setSelectedSlideIndex(initialSlideIndex);
    setActiveTemplateId(null);
  }, [initialSlideIndex]);

  const selectSlide = useCallback((slideIndex: number) => {
    setSelectedSlideIndex(slideIndex);
    setActiveTemplateId(null);
  }, []);

  const handleAdd = useCallback(() => {
    const newIndex = addSlide(importId);
    if (newIndex !== null) selectSlide(newIndex);
  }, [addSlide, importId, selectSlide]);

  const handleDuplicate = useCallback(
    (slideIndex: number) => {
      const newIndex = duplicateSlide(importId, slideIndex);
      if (newIndex !== null) selectSlide(newIndex);
    },
    [duplicateSlide, importId, selectSlide],
  );

  const handleDelete = useCallback(
    (slideIndex: number) => {
      const position = slides.findIndex((s) => s.slideIndex === slideIndex);
      const neighbour = slides[position + 1] ?? slides[position - 1];

      if (neighbour) {
        setSelectedSlideIndex(
          neighbour.slideIndex > slideIndex
            ? neighbour.slideIndex - 1
            : neighbour.slideIndex,
        );
      }

      removeSlide(importId, slideIndex);
    },
    [slides, removeSlide, importId],
  );

  const handleChange = useCallback(
    (doc: LayoutDoc) => {
      if (!selectedSlide) return;
      updateSlideDoc(importId, selectedSlide.slideIndex, doc);
    },
    [selectedSlide, updateSlideDoc, importId],
  );

  const handleSelectTemplate = useCallback(
    (templateId: string) => {
      if (!selectedSlide) return;
      const template = findCustomSlideTemplate(templateId);
      if (!template) return;

      const ok = window.confirm(
        `Replace this slide's layout with "${template.name}"? Anything you have typed or moved on it will be lost.`,
      );
      if (!ok) return;

      updateSlideDoc(importId, selectedSlide.slideIndex, template.doc);
      setActiveTemplateId(templateId);
      setSideTab("slides");
    },
    [selectedSlide, updateSlideDoc, importId],
  );

  const frame = useMemo(
    () =>
      selectedSlide
        ? { index: selectedSlide.globalIndex + 1, total: totalSceneSlides }
        : undefined,
    [selectedSlide, totalSceneSlides],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="full"
        className="desktop:w-[96vw] desktop:max-w-[1500px] desktop:h-[90vh] flex flex-col p-0 gap-0"
      >
        <DialogHeader className="px-4 py-3 border-b border-stroke shrink-0">
          <DialogTitle>Edit slides</DialogTitle>
        </DialogHeader>

        <DialogBody className="flex-1 min-h-0 p-0 overflow-hidden">
          <div className="flex flex-col desktop:flex-row h-full min-h-0">
            <Tabs
              value={sideTab}
              onValueChange={(value) => setSideTab(value as SideTab)}
              className="shrink-0 flex flex-col border-b desktop:border-b-0 desktop:border-r border-stroke desktop:w-[210px] desktop:h-full min-h-0 overflow-hidden gap-0"
            >
              <TabsList className="shrink-0 m-2">
                <TabsTrigger value="slides">Slides</TabsTrigger>
                <TabsTrigger value="layouts">Layouts</TabsTrigger>
              </TabsList>

              <TabsContent
                value="slides"
                className="flex-1 min-h-0 overflow-y-auto"
              >
                <SlideFilmstrip
                  slides={slides}
                  selectedSlideIndex={selectedSlide?.slideIndex ?? null}
                  onSelect={selectSlide}
                  onAdd={handleAdd}
                  onDuplicate={handleDuplicate}
                  onDelete={handleDelete}
                  onMove={(slideIndex, direction) =>
                    moveSlide(importId, slideIndex, direction)
                  }
                />
              </TabsContent>

              <TabsContent
                value="layouts"
                className="flex-1 min-h-0 overflow-y-auto"
              >
                <LayoutPicker
                  templates={customSlideTemplates}
                  activeId={activeTemplateId}
                  onSelect={handleSelectTemplate}
                />
              </TabsContent>
            </Tabs>

            <div className="flex-1 min-w-0 min-h-0">
              {selectedSlide && (
                <LayoutWorkbench
                  key={selectedSlide.slideId}
                  doc={selectedSlide.doc}
                  onChange={handleChange}
                  data={EMPTY_DATA}
                  frame={frame}
                  aiChat={AI_ENABLED ? deckAi : undefined}
                  pluginApi={pluginApi}
                  insertDefaults={INSERT_DEFAULTS}
                />
              )}
            </div>
          </div>
        </DialogBody>

        <DialogFooter className="px-4 py-3 border-t border-stroke shrink-0">
          <div className="stack-row flex-row-reverse w-full items-center">
            <Button variant="success" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CustomSlideEditorModal;
