import { cx } from "class-variance-authority";
import { use, useMemo } from "react";
import { useStore } from "zustand";

import "./Slide.css";
import { CustomSizeContext } from "./SlideGrid";
import { mapZoomToRange } from "./mapZoomToRange";
import type { PluginAPI } from "./types";

type PropTypes = {
  heading?: string;
  headingIsFaded?: boolean;
  isActive?: boolean;
  aspectRatio?: number;
  onClick?: () => void;
  children?:
    | React.ReactNode
    | (({ width }: { width: string }) => React.ReactNode);
  pluginAPI?: PluginAPI | null;
};

export const Slide = ({
  heading,
  headingIsFaded,
  isActive,
  aspectRatio = 16 / 9,
  onClick,
  children,
  pluginAPI,
}: PropTypes) => {
  const { forceWidth, containerWidth } = use(CustomSizeContext);
  const { zoomLevel } = pluginAPI
    ? // Breaks the rule of hook, but this should be a one time condition
      useStore(pluginAPI.remote.zoomLevel)
    : { zoomLevel: 0.5 };

  const width = useMemo(
    () =>
      forceWidth
        ? `${forceWidth}px`
        : `${mapZoomToRange(zoomLevel, containerWidth)}px`,
    [containerWidth, forceWidth, zoomLevel],
  );

  return (
    <div
      className={cx(["flex justify-center", { "cursor-pointer": !!onClick }])}
      onClick={onClick}
      data-testid="slide-container"
    >
      <div className="overflow-hidden">
        {heading && (
          <p
            className={cx([
              "ui--slide-test",
              headingIsFaded ? "font-normal" : "font-bold",
              headingIsFaded ? "text-gray-600" : "text-inherit",
            ])}
          >
            {heading}
          </p>
        )}
        <div
          className={cx([
            "select-none",
            "border-4",
            { "border-red-600": isActive, "border-transparent": !isActive },
          ])}
          style={{
            width,
            aspectRatio,
          }}
        >
          {typeof children === "function" ? children({ width }) : children}
        </div>
      </div>
    </div>
  );
};
