import { extractMediaName } from "@repo/lib";
import {
  Button,
  LoadingInline,
  OverlayToggle,
  PluginScaffold,
  Skeleton,
  Slide,
  SlideGrid,
  UniversalImage,
} from "@repo/ui";
import { useMemo } from "react";
import { FaArrowLeft, FaArrowRight, FaPlus } from "react-icons/fa";
import { VscSettingsGear } from "react-icons/vsc";

import { resolveSlide } from "../../src/slideOrderUtils";
import { usePluginAPI } from "../pluginApi";
import {
  computeGlobalSlideClickCount,
  useAutoplay,
} from "../utils/useAutoplay";
import ImportFileModal from "./ImportFile/ImportFileModal";
import Landing from "./Landing";
import SettingsModal from "./SettingsModal";
import "./index.css";

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

  if (!hasSlides && !isAnyImportFetching) {
    return <Landing />;
  }

  return (
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
            <SettingsModal />
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
            <RemoteHandler />
          </SlideGrid>
        </div>
      }
    />
  );
};

const RemoteHandler = () => {
  const pluginApi = usePluginAPI();

  const pluginData = pluginApi.scene.useData((x) => x.pluginData);
  const rendererData = pluginApi.renderer.useData((x) => x);

  const mutableRendererData = pluginApi.renderer.useValtioData();

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

  return (
    <>
      {resolvedSlides.map((slide, i) => {
        const isReplacing = replacingImportIds.has(slide.ref.importId);
        return (
          <Slide
            key={slide.rawRef}
            pluginAPI={pluginApi}
            heading={`Slide ${i + 1}`}
            isActive={i === activeIndex}
            onClick={() => {
              mutableRendererData.currentSlideIndex = i;
              mutableRendererData.currentClickCount = null;
              mutableRendererData.lastClickTimestamp = Date.now();
              pluginApi.renderer.setRenderCurrentScene();
            }}
          >
            {({ width }) => (
              <div className="center relative h-full w-full">
                <UniversalImage
                  src={extractMediaName(slide.thumbnailUrl)}
                  imgProp={{ style: { width: "100%" } }}
                  width={width}
                />
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
      <OverlayToggle
        toggler={({ onToggle }) => (
          <Slide pluginAPI={pluginApi} heading="" onClick={onToggle}>
            <div className="group h-full w-full flex flex-col items-center justify-center gap-2 border-2 border-dashed border-tertiary text-tertiary hover:border-secondary hover:text-secondary hover:bg-black/5 transition-colors">
              <FaPlus className="size-6" />
              <span className="text-sm font-medium">Add slide</span>
            </div>
          </Slide>
        )}
      >
        <ImportFileModal />
      </OverlayToggle>
    </>
  );
};

export default Remote;
