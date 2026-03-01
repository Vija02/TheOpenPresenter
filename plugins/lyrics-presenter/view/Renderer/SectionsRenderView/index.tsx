import useSize from "@react-hook/size";
import { cn } from "@repo/ui";
import React, { useMemo } from "react";

import { SlideStyle } from "../../../src";
import { GroupedData } from "../../../src/processLyrics";
import { DebugPadding } from "../DebugPadding";
import { usePadding } from "../usePadding";
import { getSvgMeasurement } from "./cache";

type SectionsRenderViewProps = {
  groupedData: GroupedData;
  currentIndex: number;
  slideStyle: Required<SlideStyle>;
};

const SectionsRenderView = (props: SectionsRenderViewProps) => {
  const { groupedData, currentIndex } = props;

  const totalSlideLength = useMemo(
    () =>
      groupedData
        .map((x) => x.slides.length)
        .reduce((acc, val) => acc + val, 0),
    [groupedData],
  );
  if (totalSlideLength <= currentIndex) {
    return null;
  }

  return <SectionsRenderViewWrapper {...props} />;
};

const SectionsRenderViewWrapper = React.memo(
  (props: SectionsRenderViewProps) => {
    const { groupedData, currentIndex, slideStyle } = props;

    const target = React.useRef<any>(null);
    const size = useSize(target);

    const textLines = useMemo(() => {
      let counter = 0;
      let index = 0;
      for (const d of groupedData) {
        if (counter + d.slides.length > currentIndex) {
          break;
        }
        counter += d.slides.length;
        index++;
      }

      return groupedData[index]?.slides[currentIndex - counter] ?? [];
    }, [currentIndex, groupedData]);

    return (
      <div
        ref={target}
        className={cn(
          "h-full relative",
          slideStyle.isDarkMode ? "bg-black" : "bg-white",
        )}
      >
        {slideStyle.autoSize ? (
          <SectionsRenderViewAutoSize
            {...props}
            textLines={textLines}
            size={size}
          />
        ) : (
          <SectionsRenderViewManualFontSize
            {...props}
            textLines={textLines}
            size={size}
          />
        )}
      </div>
    );
  },
);

const SectionsRenderViewAutoSize = React.memo(
  ({
    slideStyle,
    textLines,
    size,
  }: SectionsRenderViewProps & {
    textLines: string[];
    size: [number, number];
  }) => {
    const [width, height] = size;

    const measuredData = useMemo(
      () =>
        getSvgMeasurement({
          slideStyle,
          textLines,
        }),
      [slideStyle, textLines],
    );

    const padding = usePadding(slideStyle, { width, height });

    // CContainer dimensions after padding
    const containerWidth = width - padding[3] - padding[1];
    const containerHeight = height - padding[0] - padding[2];

    // Calculate viewBox height to match container aspect ratio
    const scaledHeight =
      measuredData.width * (containerHeight / containerWidth);

    // Extra height available for vertical positioning (capped at 0 for height-constrained content)
    const extraHeight = Math.max(0, scaledHeight - measuredData.height);

    // Calculate viewBox Y offset based on vertical alignment
    const viewBoxY = useMemo(() => {
      switch (slideStyle.verticalAlign) {
        case "top":
          return extraHeight / 2;
        case "bottom":
          return -extraHeight / 2;
        case "center":
        default:
          return 0;
      }
    }, [extraHeight, slideStyle.verticalAlign]);

    const viewBox = useMemo(
      () => [0, viewBoxY, measuredData.width, measuredData.height].join(" "),
      [viewBoxY, measuredData.width, measuredData.height],
    );

    return (
      <>
        {slideStyle.debugPadding && <DebugPadding padding={padding} />}
        <svg
          viewBox={viewBox}
          xmlns="http://www.w3.org/2000/svg"
          style={{
            width: `calc(100% - ${padding[3]}px - ${padding[1]}px)`,
            height: `calc(100% - ${padding[0]}px - ${padding[2]}px)`,
            overflow: "visible",
            userSelect: "none",
            position: "absolute",
            left: padding[3],
            top: padding[0],
          }}
        >
          <text
            x="0%"
            style={{
              fontFamily: slideStyle.fontFamily,
              fontSize: "1rem",
              fontWeight: slideStyle.fontWeight,
              fontStyle: slideStyle.fontStyle,
              textAnchor: "middle",
            }}
            fill={slideStyle.isDarkMode ? "white" : "rgb(26, 32, 44)"}
          >
            {textLines?.map((x, i) => (
              <tspan
                key={i}
                x="50%"
                dy={i === 0 ? "1em" : slideStyle.lineHeight + "em"}
              >
                {x}
              </tspan>
            ))}
          </text>
        </svg>
      </>
    );
  },
);

const SectionsRenderViewManualFontSize = React.memo(
  ({
    slideStyle,
    textLines,
    size,
  }: SectionsRenderViewProps & {
    textLines: string[];
    size: [number, number];
  }) => {
    const [width, height] = size;

    const padding = usePadding(slideStyle, { width, height });

    const justifyClass = useMemo(() => {
      switch (slideStyle.verticalAlign) {
        case "top":
          return "justify-start";
        case "bottom":
          return "justify-end";
        case "center":
        default:
          return "justify-center";
      }
    }, [slideStyle.verticalAlign]);

    return (
      <div
        className={cn(
          "flex flex-col items-center h-full overflow-hidden relative",
          justifyClass,
        )}
        style={{
          padding: padding.map((x) => x + "px").join(" "),
          fontSize: width / 280, // Magic number to get the pt scale right
        }}
      >
        {slideStyle.debugPadding && <DebugPadding padding={padding} />}
        <div
          className={cn(
            "text-center max-h-full",
            slideStyle.isDarkMode ? "text-white" : "text-[rgb(26, 32, 44)]",
          )}
          style={{
            fontWeight: slideStyle.fontWeight,
            fontStyle: slideStyle.fontStyle,
            fontSize: slideStyle.fontSize + "em",
            fontFamily: slideStyle.fontFamily,
            lineHeight: slideStyle.lineHeight,
          }}
        >
          {textLines.map((x, i, all) => (
            <React.Fragment key={i}>
              {x}
              {i < all.length - 1 && <br />}
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  },
);

export default SectionsRenderView;
