import { extractMediaName } from "@repo/lib";
import {
  Button,
  LoadingFull,
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

  if (isAnyImportFetching && !hasSlides) {
    return <LoadingFull />;
  }

  if (!hasSlides) {
    return <Landing />;
  }

  return (
    <PluginScaffold
      title="Google Slides"
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
      {resolvedSlides.map((slide, i) => (
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
          {({ width }) =>
            slide.importData._isFetching ||
            !slide.thumbnailUrl ||
            slide.thumbnailUrl === "" ? (
              <Skeleton className="h-full" />
            ) : (
              <div className="center">
                <UniversalImage
                  src={extractMediaName(slide.thumbnailUrl)}
                  imgProp={{ style: { width: "100%" } }}
                  width={width}
                />
              </div>
            )
          }
        </Slide>
      ))}
      <OverlayToggle
        toggler={({ onToggle }) => (
          <Slide pluginAPI={pluginApi} heading="⠀" onClick={onToggle}>
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
