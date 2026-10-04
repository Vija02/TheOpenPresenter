import type { PluginBaseData } from "../types";
import {
  getAutoplayDurationForSlide,
  getClickCountForSlide,
  getClickDurationForSlide,
  getTransitionDurationForSlide,
} from "./order";

/**
 * Where the presentation is, as far as a key press is concerned.
 * See `src/importers/googleSlides/AGENTS.md` for the rules this encodes.
 */
export type NavigationState = {
  slideIndex: number;
  clickCount: number;
  /** Epoch ms when the playing step finishes. 0 means no window. */
  transitionEndsAt: number;
  isTransitioningBackwards: boolean;
};

export type NavigationResult = NavigationState & {
  /** Set when the press lands on a different slide, which must be activated. */
  enteredSlide: boolean;
};

/** The state one NEXT/PREV press moves to. Pure: the server applies it. */
export const navigate = (
  pluginData: PluginBaseData,
  state: NavigationState,
  keyType: "NEXT" | "PREV",
  now: number,
): NavigationResult => {
  const { slideIndex, clickCount, transitionEndsAt } = state;
  const totalSlides = pluginData.slideOrder?.length ?? 0;
  const maxClicks = getClickCountForSlide(pluginData, slideIndex);

  const stay = (patch: Partial<NavigationState> = {}): NavigationResult => ({
    ...state,
    isTransitioningBackwards: false,
    ...patch,
    enteredSlide: false,
  });
  const enter = (patch: NavigationState): NavigationResult => ({
    ...patch,
    enteredSlide: true,
  });

  if (totalSlides === 0) return { ...state, enteredSlide: false };

  // A reverse transition is still playing
  if (state.isTransitioningBackwards && now < transitionEndsAt) {
    if (keyType === "NEXT") {
      // Cancel it and return to the slide we left, without re-running autoplay
      const returning = slideIndex + 1;
      const hasAutoplay =
        getAutoplayDurationForSlide(pluginData, returning) > 0;
      return enter({
        slideIndex: returning,
        clickCount: hasAutoplay ? -1 : 0,
        transitionEndsAt: 0,
        isTransitioningBackwards: false,
      });
    }
    // Complete it
    return stay({ clickCount: maxClicks, transitionEndsAt: 0 });
  }

  if (keyType === "NEXT") {
    // Last step of the slide still animating: only finish it
    if (clickCount >= maxClicks && now < transitionEndsAt) {
      return stay({ transitionEndsAt: 0 });
    }
    if (clickCount < maxClicks) {
      const next = clickCount + 1;
      return stay({
        clickCount: next,
        transitionEndsAt:
          now + getClickDurationForSlide(pluginData, slideIndex, next),
      });
    }
    if (slideIndex < totalSlides - 1) {
      const nextSlide = slideIndex + 1;
      const autoplayMs = getAutoplayDurationForSlide(pluginData, nextSlide);
      return enter({
        slideIndex: nextSlide,
        clickCount: 0,
        transitionEndsAt:
          now +
          getTransitionDurationForSlide(pluginData, nextSlide) +
          (autoplayMs > 0 ? autoplayMs : 0),
        isTransitioningBackwards: false,
      });
    }
    // Last slide with every build shown
    return stay();
  }

  // PREV. Backward object steps are instant, so they close the window.
  if (clickCount > 0) {
    return stay({ clickCount: clickCount - 1, transitionEndsAt: 0 });
  }
  if (
    clickCount === 0 &&
    getAutoplayDurationForSlide(pluginData, slideIndex) > 0
  ) {
    return stay({ clickCount: -1, transitionEndsAt: 0 });
  }
  if (slideIndex > 0) {
    // The reversing transition belongs to the slide being left
    return enter({
      slideIndex: slideIndex - 1,
      clickCount: getClickCountForSlide(pluginData, slideIndex - 1),
      transitionEndsAt:
        now + getTransitionDurationForSlide(pluginData, slideIndex),
      isTransitioningBackwards: true,
    });
  }
  // First slide at click 0
  return stay({ transitionEndsAt: 0 });
};

/** Where one press lands once the current step has finished playing. */
export const settledStep = (
  pluginData: PluginBaseData,
  position: { slideIndex: number; clickCount: number },
  keyType: "NEXT" | "PREV",
): { slideIndex: number; clickCount: number } | null => {
  const result = navigate(
    pluginData,
    { ...position, transitionEndsAt: 0, isTransitioningBackwards: false },
    keyType,
    0,
  );
  if (
    result.slideIndex === position.slideIndex &&
    result.clickCount === position.clickCount
  ) {
    return null;
  }
  return { slideIndex: result.slideIndex, clickCount: result.clickCount };
};
