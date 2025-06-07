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

    const viewBox = useMemo(
      () => [0, 0, measuredData.width, measuredData.height].join(" "),
      [measuredData.height, measuredData.width],
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

    return (
      <div
        className="flex flex-col items-center justify-center h-full overflow-hidden relative"
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
