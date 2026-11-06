import { cx } from "class-variance-authority";
import type { MouseEvent } from "react";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { MdAnimation } from "react-icons/md";

import {
  activateSlide,
  valtioActivationTarget,
} from "../../src/slides/activation";
import { usePluginAPI } from "../pluginApi";

const stop = (e: MouseEvent) => e.stopPropagation();

/** Small corner tag telling people this slide has animations to step through. */
export const StepBadge = ({ totalSteps }: { totalSteps: number }) => (
  <div
    data-testid="slide-step-badge"
    className="pointer-events-none absolute bottom-1 left-1 flex items-center rounded-full bg-black/70 px-1.5 py-0.5 text-[10px] font-medium leading-none text-white"
    aria-label={`${totalSteps} animations`}
  >
    <MdAnimation className="size-3 shrink-0" />
    <span className="ml-1 tabular-nums">{totalSteps}</span>
    <span className="grid grid-cols-[0fr] transition-[grid-template-columns] duration-200 group-hover/slide:grid-cols-[1fr]">
      <span className="overflow-hidden whitespace-nowrap">
        &nbsp;{totalSteps === 1 ? "animation" : "animations"}
      </span>
    </span>
  </div>
);

type StepControlsProps = {
  slideIndex: number;
  clickCount: number;
  totalSteps: number;
  className?: string;
};

/** A bar for stepping through a slide's animations without a keyboard */
export const StepControls = ({
  slideIndex,
  clickCount,
  totalSteps,
  className,
}: StepControlsProps) => {
  const pluginApi = usePluginAPI();
  const sceneId = pluginApi.pluginContext.sceneId;
  const pluginData = pluginApi.scene.useData((x) => x.pluginData);
  const mutableRendererData = pluginApi.renderer.useValtioData();
  const current = Math.min(Math.max(clickCount, 0), totalSteps);
  const isDone = current >= totalSteps;

  const press = (keyType: "PREV" | "NEXT") => (e: MouseEvent) => {
    e.stopPropagation();
    pluginApi.renderer.triggerKeyPress(keyType, sceneId);
  };

  const jumpTo = (step: number) => (e: MouseEvent) => {
    e.stopPropagation();
    activateSlide(
      valtioActivationTarget(mutableRendererData),
      pluginData,
      slideIndex,
      { clickCount: step },
    );
    pluginApi.renderer.setRenderCurrentScene();
  };

  return (
    <div
      data-testid="slide-step-controls"
      className={cx([
        "flex w-full items-stretch bg-black/75 text-white",
        className,
      ])}
      onClick={stop}
      onDoubleClick={stop}
    >
      <button
        type="button"
        onClick={press("PREV")}
        title="Back"
        aria-label="Back"
        className="flex w-7 shrink-0 items-center justify-center hover:bg-white/20 active:bg-white/30"
      >
        <FaChevronLeft className="size-3" />
      </button>

      <div
        className="flex min-w-0 flex-1 items-stretch gap-0.5"
        role="group"
        aria-label={`Step ${current} of ${totalSteps}`}
      >
        {/* Step 0 is the slide as it first appears, before any builds */}
        {Array.from({ length: totalSteps + 1 }, (_, step) => {
          const label = step === 0 ? "Go to start" : `Go to step ${step}`;
          return (
            <button
              key={step}
              type="button"
              onClick={jumpTo(step)}
              title={label}
              aria-label={label}
              aria-current={step === current ? "step" : undefined}
              // Whole height is tappable; the visible bar is the thin line inside
              className="group flex min-w-0 flex-1 items-center"
            >
              <span
                className={cx([
                  "h-1 w-full rounded-full transition-colors group-hover:h-1.5",
                  step <= current
                    ? "bg-white"
                    : "bg-white/30 group-hover:bg-white/50",
                ])}
              />
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={press("NEXT")}
        title={isDone ? "Next slide" : "Play next animation"}
        aria-label={isDone ? "Next slide" : "Play next animation"}
        className="flex w-7 shrink-0 items-center justify-center hover:bg-white/20 active:bg-white/30"
      >
        <FaChevronRight className="size-3" />
      </button>
    </div>
  );
};
