import { PluginAPIContext } from "@repo/base-plugin/client";
import cx from "classnames";
import { use, useContext, useMemo } from "react";
import { useStore } from "zustand";

import "./Slide.css";
import { CustomSizeContext } from "./SlideGrid";
import { mapZoomToRange } from "./mapZoomToRange";

type PropTypes = {
  heading?: string;
  headingIsFaded?: boolean;
  isActive?: boolean;
  aspectRatio?: number;
  onClick?: () => void;
  children?:
    | React.ReactNode
    | (({ width }: { width: string }) => React.ReactNode);
};

export const Slide = ({
  heading,
  headingIsFaded,
  isActive,
  aspectRatio = 16 / 9,
  onClick,
  children,
}: PropTypes) => {
  const { forceWidth, containerWidth } = use(CustomSizeContext);
  const val = useContext(PluginAPIContext);
  const { zoomLevel } = val.pluginAPI
    ? // Breaks the rule of hook, but this should be a one time condition
      useStore(val.pluginAPI.remote.zoomLevel)
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
