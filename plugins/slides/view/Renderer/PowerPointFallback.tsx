import { Component, type ReactNode } from "react";

import { getEffectiveDisplayMode, hasOfficeSlideshow } from "../../src/types";
import { usePluginAPI } from "../pluginApi";
import { useDisplayedSlide } from "../utils/useDisplayedSlide";
import { ImageRenderView } from "./ImageRenderer/ImageRenderView";

/** The current PowerPoint slide as its still image */
export const StillSlide = () => {
  const pluginApi = usePluginAPI();
  const displayModes = pluginApi.renderer.useData((x) => x.displayModes);
  const { resolvedSlide } = useDisplayedSlide();
  if (
    !resolvedSlide ||
    !hasOfficeSlideshow(resolvedSlide.importData) ||
    getEffectiveDisplayMode(resolvedSlide.importData, displayModes) !==
      "powerpoint" ||
    !resolvedSlide.thumbnailUrl
  ) {
    return null;
  }
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <ImageRenderView src={resolvedSlide.thumbnailUrl} isActive />
    </div>
  );
};

/**
 * If the PowerPoint renderer can't load (e.g. its code failed to download
 * while offline), keep the show going with still slides rather than nothing.
 */
export class PowerPointFallback extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    window.reportError?.(error);
  }

  render() {
    return this.state.failed ? <StillSlide /> : this.props.children;
  }
}
