import { Button } from "@repo/ui";
import { useCallback, useMemo, useState } from "react";
import { FaTimes } from "react-icons/fa";
import { MdGridView } from "react-icons/md";

import {
  activateSlide,
  valtioActivationTarget,
} from "../../../src/slides/activation";
import { settledStep } from "../../../src/slides/navigation";
import { resolveSlide } from "../../../src/slides/order";
import type { ResolvedSlide } from "../../../src/types";
import { usePluginAPI } from "../../pluginApi";
import { useDisplayedSlide } from "../../utils/useDisplayedSlide";
import { MainSlide } from "./MainSlide";
import { PreviewStep, SidePreviews } from "./SidePreviews";
import { SlideOverview } from "./SlideOverview";
import { SpeakerNotesPanel } from "./SpeakerNotesPanel";
import { SlideCapturer } from "./capture/SlideCapturer";
import { useIsPortrait } from "./useIsPortrait";

type PresenterViewProps = {
  onClose: () => void;
};

export const PresenterView = ({ onClose }: PresenterViewProps) => {
  const pluginApi = usePluginAPI();
  const pluginData = pluginApi.scene.useData((x) => x.pluginData);
  const mutableRendererData = pluginApi.renderer.useValtioData();
  const { resolvedSlide, globalSlideIndex, clickCount } = useDisplayedSlide();
  const isPortrait = useIsPortrait();
  const [isOverviewOpen, setIsOverviewOpen] = useState(false);

  const totalSlides = pluginData.slideOrder?.length ?? 0;

  // Where a press would land, once the current step has finished
  const stepTowards = useCallback(
    (keyType: "NEXT" | "PREV"): PreviewStep | null => {
      if (globalSlideIndex < 0) return null;
      const step = settledStep(
        pluginData,
        { slideIndex: globalSlideIndex, clickCount },
        keyType,
      );
      const slide = step && resolveSlide(pluginData, step.slideIndex);
      return slide ? { slide, clickCount: step.clickCount } : null;
    },
    [pluginData, globalSlideIndex, clickCount],
  );
  const previousStep = useMemo(() => stepTowards("PREV"), [stepTowards]);
  const nextStep = useMemo(() => stepTowards("NEXT"), [stepTowards]);

  const selectStep = useCallback(
    ({ slide, clickCount }: PreviewStep) => {
      activateSlide(
        valtioActivationTarget(mutableRendererData),
        pluginData,
        slide.globalSlideIndex,
        { clickCount },
      );
      pluginApi.renderer.setRenderCurrentScene();
    },
    [mutableRendererData, pluginData, pluginApi],
  );

  // Same as picking a slide on the front page
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
  const closeOverview = useCallback(() => setIsOverviewOpen(false), []);

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
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsOverviewOpen(true)}
            title="All slides"
            aria-label="All slides"
            className="ml-auto"
          >
            <MdGridView />
          </Button>
          <span className="text-xs tabular-nums text-secondary">
            {globalSlideIndex >= 0 ? globalSlideIndex + 1 : 0} / {totalSlides}
          </span>
        </div>

        <SidePreviews
          fillWidth={isPortrait}
          currentSlide={resolvedSlide}
          previous={previousStep}
          next={nextStep}
          onSelect={selectStep}
        />
      </div>

      <SpeakerNotesPanel slide={resolvedSlide} />

      <SlideCapturer currentSlide={globalSlideIndex} />

      {isOverviewOpen && (
        <SlideOverview
          currentSlide={globalSlideIndex}
          onSelect={selectSlide}
          onClose={closeOverview}
        />
      )}
    </div>
  );
};

export default PresenterView;
