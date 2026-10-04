import { Button } from "@repo/ui";
import { useCallback, useMemo } from "react";
import { FaTimes } from "react-icons/fa";

import {
  activateSlide,
  valtioActivationTarget,
} from "../../../src/slides/activation";
import { resolveSlide } from "../../../src/slides/order";
import type { ResolvedSlide } from "../../../src/types";
import { usePluginAPI } from "../../pluginApi";
import { useDisplayedSlide } from "../../utils/useDisplayedSlide";
import { MainSlide } from "./MainSlide";
import { SidePreviews } from "./SidePreviews";
import { SpeakerNotesPanel } from "./SpeakerNotesPanel";
import { useIsPortrait } from "./useIsPortrait";

type PresenterViewProps = {
  onClose: () => void;
};

export const PresenterView = ({ onClose }: PresenterViewProps) => {
  const pluginApi = usePluginAPI();
  const pluginData = pluginApi.scene.useData((x) => x.pluginData);
  const mutableRendererData = pluginApi.renderer.useValtioData();
  const { resolvedSlide, globalSlideIndex } = useDisplayedSlide();
  const isPortrait = useIsPortrait();

  const totalSlides = pluginData.slideOrder?.length ?? 0;

  const previousSlide = useMemo(
    () =>
      globalSlideIndex > 0
        ? resolveSlide(pluginData, globalSlideIndex - 1)
        : null,
    [pluginData, globalSlideIndex],
  );

  const nextSlide = useMemo(
    () =>
      globalSlideIndex >= 0 && globalSlideIndex + 1 < totalSlides
        ? resolveSlide(pluginData, globalSlideIndex + 1)
        : null,
    [pluginData, globalSlideIndex, totalSlides],
  );

  // Same as selecting a slide in the remote's slide list
  const selectSlide = useCallback(
    (slide: ResolvedSlide) => {
      activateSlide(
        valtioActivationTarget(mutableRendererData),
        pluginData,
        slide.globalSlideIndex,
        { clickCount: null },
      );
      pluginApi.renderer.setRenderCurrentScene();
    },
    [mutableRendererData, pluginData, pluginApi],
  );

  return (
    <div
      data-testid="speaker-view"
      className="fixed inset-0 z-50 flex flex-col bg-surface-primary text-primary landscape:flex-row"
    >
      <Button
        variant="ghost"
        size="icon"
        onClick={onClose}
        title="Close speaker view"
        aria-label="Close speaker view"
        className="absolute right-2 top-2 z-10"
      >
        <FaTimes />
      </Button>

      <div className="flex min-h-0 min-w-0 flex-col p-3 portrait:flex-initial portrait:pt-13 landscape:flex-1 sm:p-4 sm:portrait:pt-13">
        <MainSlide slide={resolvedSlide} />

        <div className="mt-3 flex shrink-0 items-center gap-2">
          <span className="ml-auto text-xs tabular-nums text-secondary">
            {globalSlideIndex >= 0 ? globalSlideIndex + 1 : 0} / {totalSlides}
          </span>
        </div>

        <SidePreviews
          fillWidth={isPortrait}
          currentSlide={resolvedSlide}
          previousSlide={previousSlide}
          nextSlide={nextSlide}
          onSelect={selectSlide}
        />
      </div>

      <SpeakerNotesPanel slide={resolvedSlide} />
    </div>
  );
};

export default PresenterView;
