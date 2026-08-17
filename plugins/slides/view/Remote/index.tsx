import { LayoutRenderer } from "@repo/layout/react";
import {
  Button,
  LoadingInline,
  OverlayToggle,
  PluginScaffold,
  Skeleton,
  Slide,
  SlideGrid,
} from "@repo/ui";
import { useCallback, useMemo, useState } from "react";
import { FaArrowLeft, FaArrowRight, FaPlus } from "react-icons/fa";
import { VscEdit, VscSettingsGear } from "react-icons/vsc";

import { imageSlideDoc, isCustomImport } from "../../src/customSlides";
import { parseSlideRef, resolveSlide } from "../../src/slideOrderUtils";
import { usePluginAPI } from "../pluginApi";
import {
  computeGlobalSlideClickCount,
  useAutoplay,
} from "../utils/useAutoplay";
import CustomSlideEditorModal from "./CustomSlides/CustomSlideEditorModal";
import { useCustomSlides } from "./CustomSlides/useCustomSlides";
import Landing from "./Landing";
import SettingsModal from "./SettingsModal";
import "./index.css";
import { useSlideMediaPicker } from "./integrations";

export type EditorTarget = { importId: string; slideIndex: number };

const Remote = () => {
  const pluginApi = usePluginAPI();

  const sceneId = pluginApi.pluginContext.sceneId;
  const pluginData = pluginApi.scene.useData((x) => x.pluginData);

  const hasSlides = (pluginData.slideOrder?.length ?? 0) > 0;

  const isAnyImportFetching = useMemo(() => {
    return Object.values(pluginData.imports).some(
      (importData) => importData._isFetching,
    );
  }, [pluginData.imports]);

  const [editorTarget, setEditorTarget] = useState<EditorTarget | null>(null);

  const showLanding = !hasSlides && !isAnyImportFetching;

  return (
    <>
      {showLanding ? (
        <Landing onCustomSlideEdit={setEditorTarget} />
      ) : (
        <PluginScaffold
          title="Slides"
          postToolbar={
            <>
              <OverlayToggle
                toggler={({ onToggle }) => (
                  <Button size="xs" variant="pill" onClick={onToggle}>
                    <VscSettingsGear />
                    Settings
                  </Button>
                )}
              >
                <SettingsModal onCustomSlideEdit={setEditorTarget} />
              </OverlayToggle>
            </>
          }
          toolbar={
            <div className="stack-row gap-x-4 gap-y-2 flex-wrap">
              <div className="stack-row">
                <span className="hidden sm:inline font-bold text-white text-xs">
                  Navigate:
                </span>
                <Button
                  size="xs"
                  variant="pill"
                  onClick={() => {
                    pluginApi.renderer.triggerKeyPress("PREV", sceneId);
                  }}
                >
                  <FaArrowLeft />
                  Left
                </Button>
                <Button
                  size="xs"
                  variant="pill"
                  onClick={() => {
                    pluginApi.renderer.triggerKeyPress("NEXT", sceneId);
                  }}
                >
                  <FaArrowRight /> Right
                </Button>
              </div>
            </div>
          }
          body={
            <div className="p-3 w-full">
              <SlideGrid pluginAPI={pluginApi}>
                <RemoteHandler onCustomSlideEdit={setEditorTarget} />
              </SlideGrid>
            </div>
          }
        />
      )}

      {editorTarget && (
        <CustomSlideEditorModal
          key={editorTarget.importId}
          importId={editorTarget.importId}
          initialSlideIndex={editorTarget.slideIndex}
          open
          onOpenChange={(open) => !open && setEditorTarget(null)}
        />
      )}
    </>
  );
};

type RemoteHandlerProps = {
  onCustomSlideEdit: (target: EditorTarget) => void;
};

const RemoteHandler = ({ onCustomSlideEdit }: RemoteHandlerProps) => {
  const pluginApi = usePluginAPI();

  const pluginData = pluginApi.scene.useData((x) => x.pluginData);
  const rendererData = pluginApi.renderer.useData((x) => x);

  const mutableRendererData = pluginApi.renderer.useValtioData();

  const { integrationHosts, pickMedia } = useSlideMediaPicker();
  const { createDeck, addSlide } = useCustomSlides();

  const resolvedSlides = pluginData.slideOrder
    .map((_, i) => resolveSlide(pluginData, i))
    .filter((x) => !!x);

  const fetchingImports = useMemo(
    () =>
      Object.values(pluginData.imports).filter(
        (importData) => importData._isFetching,
      ),
    [pluginData.imports],
  );

  const replacingImportIds = useMemo(() => {
    const set = new Set<string>();
    for (const imp of fetchingImports) {
      if (imp.replaceImportId) set.add(imp.replaceImportId);
    }
    return set;
  }, [fetchingImports]);

  const appendingFetchingImports = useMemo(
    () => fetchingImports.filter((imp) => !imp.replaceImportId),
    [fetchingImports],
  );

  const baseIndex = rendererData.currentSlideIndex ?? 0;
  const baseClickCount = rendererData.currentClickCount ?? 0;

  const globalSlideClickCount = useMemo(
    () => computeGlobalSlideClickCount(pluginData, rendererData.displayModes),
    [pluginData, rendererData.displayModes],
  );

  const { shouldAutoPlay, calculatedAutoplaySlideIndex } = useAutoplay({
    baseIndex,
    baseClickCount,
    globalSlideClickCount,
  });

  const activeIndex = useMemo(() => {
    if (shouldAutoPlay && calculatedAutoplaySlideIndex !== null) {
      return calculatedAutoplaySlideIndex;
    }

    return baseIndex;
  }, [shouldAutoPlay, calculatedAutoplaySlideIndex, baseIndex]);

  const totalSlides = pluginData.slideOrder?.length ?? 0;

  const lastCustomDeckId = useMemo(() => {
    const order = pluginData.slideOrder ?? [];
    for (let i = order.length - 1; i >= 0; i--) {
      const ref = order[i];
      if (!ref) continue;
      const importData = pluginData.imports[parseSlideRef(ref).importId];
      if (isCustomImport(importData)) return importData.importId;
    }
    return null;
  }, [pluginData]);

  const handleCreateFromScratch = useCallback(() => {
    // Extend the deck
    if (lastCustomDeckId) {
      const newIndex = addSlide(lastCustomDeckId);
      if (newIndex !== null) {
        onCustomSlideEdit({ importId: lastCustomDeckId, slideIndex: newIndex });
      }
      return;
    }

    onCustomSlideEdit({ importId: createDeck(), slideIndex: 0 });
  }, [lastCustomDeckId, addSlide, createDeck, onCustomSlideEdit]);

  return (
    <>
      {integrationHosts}

      {resolvedSlides.map((slide) => {
        const isReplacing = replacingImportIds.has(slide.ref.importId);
        const index = slide.globalSlideIndex;
        const customImport = isCustomImport(slide.importData)
          ? slide.importData
          : null;
        const isCustom = customImport !== null;

        const doc =
          customImport?.docs[slide.localSlideIndex] ??
          imageSlideDoc(slide.thumbnailUrl);

        return (
          <Slide
            key={slide.rawRef}
            pluginAPI={pluginApi}
            heading={`Slide ${index + 1}`}
            isActive={index === activeIndex}
            headingRight={
              isCustom ? (
                <div
                  className="flex items-center"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button
                    size="xs"
                    variant="ghost"
                    title="Edit slide"
                    onClick={() =>
                      onCustomSlideEdit({
                        importId: slide.ref.importId,
                        slideIndex: slide.localSlideIndex,
                      })
                    }
                  >
                    <VscEdit />
                  </Button>
                </div>
              ) : undefined
            }
            onClick={() => {
              mutableRendererData.currentSlideIndex = index;
              mutableRendererData.currentClickCount = null;
              mutableRendererData.lastClickTimestamp = Date.now();
              pluginApi.renderer.setRenderCurrentScene();
            }}
          >
            {() => (
              <div className="center relative h-full w-full">
                <div
                  className="h-full w-full bg-black"
                  onDoubleClick={
                    isCustom
                      ? () =>
                          onCustomSlideEdit({
                            importId: slide.ref.importId,
                            slideIndex: slide.localSlideIndex,
                          })
                      : undefined
                  }
                >
                  <LayoutRenderer
                    doc={doc}
                    data={{}}
                    frame={{ index: index + 1, total: totalSlides }}
                  />
                </div>
                {isReplacing && (
                  <div className="absolute bottom-1 right-1 flex items-center justify-center rounded-full bg-black/60 p-1 text-white">
                    <LoadingInline className="size-3" />
                  </div>
                )}
              </div>
            )}
          </Slide>
        );
      })}

      {/* Render skeletons when importing */}
      {appendingFetchingImports.flatMap((importData, importIdx) => {
        const knownCount = importData.thumbnailLinks?.length ?? 0;
        const isUnknownCount = knownCount === 0;
        const count = isUnknownCount ? 1 : knownCount;
        const prevCount = appendingFetchingImports
          .slice(0, importIdx)
          .reduce(
            (acc, imp) => acc + Math.max(imp.thumbnailLinks?.length ?? 0, 1),
            0,
          );
        return Array.from({ length: count }, (_, i) => (
          <Slide
            key={`fetching-${importData.importId}-${i}`}
            pluginAPI={pluginApi}
            heading={
              isUnknownCount
                ? ""
                : `Slide ${resolvedSlides.length + prevCount + i + 1}`
            }
          >
            {() => (
              <div className="relative h-full w-full">
                <Skeleton className="h-full w-full" />
                {isUnknownCount && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-secondary">
                    <LoadingInline className="size-6" />
                    <span className="text-sm font-medium">Importing...</span>
                  </div>
                )}
              </div>
            )}
          </Slide>
        ));
      })}

      <Slide
        pluginAPI={pluginApi}
        heading=""
        onClick={() =>
          pickMedia({
            multiple: true,
            onCreateFromScratch: handleCreateFromScratch,
          })
        }
      >
        <div className="group h-full w-full flex flex-col items-center justify-center gap-2 border-2 border-dashed border-tertiary text-tertiary hover:border-secondary hover:text-secondary hover:bg-black/5 transition-colors cursor-pointer">
          <FaPlus className="size-6" />
          <span className="text-sm font-medium">Add slide</span>
        </div>
      </Slide>
    </>
  );
};

export default Remote;
