import useSize from "@react-hook/size";
import { cn } from "@repo/ui";
import React, { useMemo } from "react";

import { SlideStyle } from "../../../src";
import { GroupedData } from "../../../src/processLyrics";
import { DebugPadding } from "../DebugPadding";
import { usePadding } from "../usePadding";
import { useVideoBackgroundThumbnail } from "../useVideoBackgroundThumbnail";
import { getSvgMeasurement } from "./cache";

type SectionsRenderViewProps = {
  groupedData: GroupedData;
  currentIndex: number;
  slideStyle: Required<SlideStyle>;
  renderVideoThumbnail?: boolean;
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
    const {
      groupedData,
      currentIndex,
      slideStyle,
      renderVideoThumbnail = false,
    } = props;

    const target = React.useRef<any>(null);
    const size = useSize(target);

    const backgroundImageUrl = useVideoBackgroundThumbnail(
      slideStyle,
      renderVideoThumbnail,
    );

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

    const backgroundStyle = useMemo(() => {
      if (slideStyle.backgroundType === "video") {
        if (backgroundImageUrl) {
          return {
            backgroundImage: `url(${backgroundImageUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          };
        }
        return { backgroundColor: "transparent" };
      }
      return { backgroundColor: slideStyle.backgroundColor };
    }, [
      slideStyle.backgroundType,
      slideStyle.backgroundColor,
      backgroundImageUrl,
    ]);

    return (
      <div ref={target} className="h-full relative" style={backgroundStyle}>
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

    // Calculate scale factor for text effects
    // The SVG scales from viewBox coordinates to container size
    const scaleFactor = containerWidth / measuredData.width;
    // Shadow blur in pixels - scales with the container size
    const shadowBlur1 = 1 * scaleFactor;
    const shadowBlur2 = 2 * scaleFactor;
    // Stroke width stays constant in viewBox units (doesn't scale with screen size)
    const strokeWidth = 0.02;

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
          {/* Shadow layer - rendered first, behind the main text */}
          {slideStyle.textShadow && (
            <text
              x="0%"
              style={{
                fontFamily: slideStyle.fontFamily,
                fontSize: "1rem",
                fontWeight: slideStyle.fontWeight,
                fontStyle: slideStyle.fontStyle,
                textAnchor: "middle",
                textShadow: `0 0 ${shadowBlur1}px rgba(0,0,0,0.9), 0 0 ${shadowBlur2}px rgba(0,0,0,0.6)`,
              }}
              fill={slideStyle.textColor}
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
          )}
          {/* Main text layer */}
          <text
            x="0%"
            style={{
              fontFamily: slideStyle.fontFamily,
              fontSize: "1rem",
              fontWeight: slideStyle.fontWeight,
              fontStyle: slideStyle.fontStyle,
              textAnchor: "middle",
              stroke: slideStyle.textOutline ? "black" : undefined,
              strokeWidth: slideStyle.textOutline
                ? `${strokeWidth}em`
                : undefined,
              paintOrder: "stroke fill",
            }}
            fill={slideStyle.textColor}
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

    const baseFontSize = width / 280; // Magic number to get the pt scale right
    const actualFontSize = baseFontSize * Number(slideStyle.fontSize);
    // Scale shadow proportionally to the rendered font size
    const shadowBlur1 = actualFontSize * 0.06;
    const shadowBlur2 = actualFontSize * 0.12;
    const strokeWidth = actualFontSize * 0.02;

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
          fontSize: baseFontSize,
        }}
      >
        {slideStyle.debugPadding && <DebugPadding padding={padding} />}
        <div
          className="text-center max-h-full"
          style={{
            fontWeight: slideStyle.fontWeight,
            fontStyle: slideStyle.fontStyle,
            fontSize: slideStyle.fontSize + "em",
            fontFamily: slideStyle.fontFamily,
            lineHeight: slideStyle.lineHeight,
            color: slideStyle.textColor,
            textShadow: slideStyle.textShadow
              ? `0 0 ${shadowBlur1}px rgba(0,0,0,0.9), 0 0 ${shadowBlur2}px rgba(0,0,0,0.6)`
              : undefined,
            WebkitTextStroke: slideStyle.textOutline
              ? `${strokeWidth}px black`
              : undefined,
            paintOrder: "stroke fill",
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
