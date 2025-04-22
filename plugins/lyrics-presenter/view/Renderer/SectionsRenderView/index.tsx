import { Box, Text } from "@chakra-ui/react";
import useSize from "@react-hook/size";
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
      <Box
        ref={target}
        height="100%"
        position="relative"
        backgroundColor={slideStyle.isDarkMode ? "black" : "white"}
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
      </Box>
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
            width: `calc(100% - ${padding[0]}px - ${padding[2]}px)`,
            height: `calc(100% - ${padding[1]}px - ${padding[3]}px)`,
            overflow: "visible",
            userSelect: "none",
            position: "absolute",
            left: padding[0],
            top: padding[1],
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
      <Box
        display="flex"
        flexDir="column"
        alignItems="center"
        justifyContent="center"
        height="100%"
        overflow="hidden"
        padding={padding.map((x) => x + "px").join(" ")}
        position="relative"
        fontSize={width / 280} // Magic number to get the pt scale right
      >
        {slideStyle.debugPadding && <DebugPadding padding={padding} />}
        <Text
          fontWeight={slideStyle.fontWeight}
          fontStyle={slideStyle.fontStyle}
          color={slideStyle.isDarkMode ? "white" : "rgb(26, 32, 44)"}
          fontSize={slideStyle.fontSize + "em"}
          fontFamily={slideStyle.fontFamily}
          lineHeight={slideStyle.lineHeight}
          textAlign="center"
          maxHeight="100%"
        >
          {textLines.map((x, i, all) => (
            <React.Fragment key={i}>
              {x}
              {i < all.length - 1 && <br />}
            </React.Fragment>
          ))}
        </Text>
      </Box>
    );
  },
);

export default SectionsRenderView;
