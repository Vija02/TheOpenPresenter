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
import { FaArrowLeft, FaArrowRight } from "react-icons/fa";
import { VscSettingsGear } from "react-icons/vsc";

import Renderer from "../Renderer";
import { usePluginAPI } from "../pluginApi";
import ImportFileModal from "./ImportFile/ImportFileModal";
import Landing from "./Landing";
import SettingsModal from "./SettingsModal";
import "./index.css";

const Remote = () => {
  const pluginApi = usePluginAPI();

  const mutableRendererData = pluginApi.renderer.useValtioData();

  const fetchId = pluginApi.scene.useData((x) => x.pluginData.fetchId);
  const isFetching = pluginApi.scene.useData((x) => x.pluginData._isFetching);

  if (!!isFetching && !fetchId) {
    return <LoadingFull />;
  }

  if (!fetchId) {
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
          <OverlayToggle
            toggler={({ onToggle }) => (
              <Button size="xs" variant="pill" onClick={onToggle}>
                Replace Slide
              </Button>
            )}
          >
            <ImportFileModal />
          </OverlayToggle>

          <div className="stack-row">
            <span className="hidden sm:inline font-bold text-white text-xs">
              Navigate:
            </span>
            <Button
              size="xs"
              variant="pill"
              onClick={() => {
                if (mutableRendererData.slideIndex == null) {
                  mutableRendererData.slideIndex = 0;
                } else {
                  mutableRendererData.clickCount =
                    (mutableRendererData.clickCount ?? 0) - 1;
                }
              }}
            >
              <FaArrowLeft />
              Left
            </Button>
            <Button
              size="xs"
              variant="pill"
              onClick={() => {
                if (mutableRendererData.slideIndex == null) {
                  mutableRendererData.slideIndex = 0;
                } else {
                  mutableRendererData.clickCount =
                    (mutableRendererData.clickCount ?? 0) + 1;
                }
              }}
            >
              <FaArrowRight /> Right
            </Button>
          </div>
        </div>
      }
      body={
        <div className="p-3 w-full">
          <SlideGrid>
            <RemoteHandler />
          </SlideGrid>

          <ResolvedSlideHandler />
        </div>
      }
    />
  );
};

const ResolvedSlideHandler = () => {
  const pluginApi = usePluginAPI();
  const type = pluginApi.scene.useData((x) => x.pluginData.type);
  const slideIndex = pluginApi.renderer.useData((x) => x.slideIndex);
  const displayMode = pluginApi.renderer.useData((x) => x.displayMode);

  if (type === "pdf" || type === "ppt" || displayMode === "image") {
    return null;
  }

  // We render this to calculate what slide is currently selected through clicking
  return (
    <div className="content-hidden">
      {slideIndex !== undefined && slideIndex !== null && (
        <Renderer shouldUpdateResolvedSlideIndex />
      )}
    </div>
  );
};

const RemoteHandler = () => {
  const pluginApi = usePluginAPI();
  const thumbnailLinks = pluginApi.scene.useData(
    (x) => x.pluginData.thumbnailLinks,
  );
  const type = pluginApi.scene.useData((x) => x.pluginData.type);
  const rendererData = pluginApi.renderer.useData((x) => x);

  const mutableRendererData = pluginApi.renderer.useValtioData();

  const actualSlideIndex = useMemo(
    () =>
      type === "pdf" || type === "ppt" || rendererData.displayMode === "image"
        ? (rendererData.slideIndex ?? 0) + (rendererData.clickCount ?? 0)
        : rendererData.resolvedSlideIndex !== null
          ? rendererData.resolvedSlideIndex
          : rendererData.slideIndex,
    [
      rendererData.clickCount,
      rendererData.displayMode,
      rendererData.resolvedSlideIndex,
      rendererData.slideIndex,
      type,
    ],
  );

  return (
    <>
      {thumbnailLinks.map((thumbnailLink, i) => (
        <Slide
          key={i}
          heading={`Slide ${i + 1}`}
          isActive={i === actualSlideIndex}
          onClick={() => {
            mutableRendererData.slideIndex = i;
            mutableRendererData.clickCount = null;
            mutableRendererData.resolvedSlideIndex = null;
            pluginApi.renderer.setRenderCurrentScene();
          }}
        >
          {({ width }) =>
            thumbnailLink && thumbnailLink !== "" ? (
              <div className="center">
                <UniversalImage
                  src={extractMediaName(thumbnailLink)}
                  imgProp={{ style: { width: "100%" } }}
                  width={width}
                />
              </div>
            ) : (
              <Skeleton className="h-full" />
            )
          }
        </Slide>
      ))}
    </>
  );
};

export default Remote;
