import { Box, Text } from "@chakra-ui/react";
import useSize from "@react-hook/size";
import React, { useMemo } from "react";

import { SlideStyle } from "../../../src";
import { GroupedData } from "../../../src/processLyrics";
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
    const measuredData = useMemo(
      () =>
        getSvgMeasurement({
          slideStyle,
          textLines,
        }),
      [slideStyle, textLines],
    );
    const finalPadding = useMemo(
      () => (slideStyle.padding / 100) * size[0],
      [size, slideStyle.padding],
    );

    const viewBox = useMemo(
      () => [0, 0, measuredData.width, measuredData.height].join(" "),
      [measuredData.height, measuredData.width],
    );
    return (
      <>
        {slideStyle.debugPadding && <DebugPadding padding={finalPadding} />}
        <svg
          viewBox={viewBox}
          xmlns="http://www.w3.org/2000/svg"
          style={{
            width: `calc(100% - ${finalPadding * 2}px)`,
            height: `calc(100% - ${finalPadding * 2}px)`,
            overflow: "visible",
            userSelect: "none",
            position: "absolute",
            top: finalPadding,
            left: finalPadding,
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

    const padding = (slideStyle.padding / 100) * size[0];
    const finalPadding = Math.min(width / 2, height / 2, padding);

    return (
      <Box
        display="flex"
        flexDir="column"
        alignItems="center"
        justifyContent="center"
        height="100%"
        overflow="hidden"
        padding={finalPadding + "px"}
        position="relative"
      >
        {slideStyle.debugPadding && <DebugPadding padding={finalPadding} />}
        <Text
          fontWeight={slideStyle.fontWeight}
          fontStyle={slideStyle.fontStyle}
          color={slideStyle.isDarkMode ? "white" : "rgb(26, 32, 44)"}
          fontSize={slideStyle.fontSize}
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

const DebugPadding = ({ padding }: { padding: number }) => {
  return (
    <>
      <Box
        position="absolute"
        left={0}
        top={0}
        bottom={0}
        borderLeft={`${padding}px solid rgb(115, 94, 255)`}
        borderTop={`${padding}px solid transparent`}
        borderBottom={`${padding}px solid transparent`}
        opacity={0.7}
      />
      <Box
        position="absolute"
        right={0}
        top={0}
        bottom={0}
        borderRight={`${padding}px solid rgb(115, 94, 255)`}
        borderTop={`${padding}px solid transparent`}
        borderBottom={`${padding}px solid transparent`}
        opacity={0.7}
      />
      <Box
        position="absolute"
        top={0}
        left={0}
        right={0}
        borderTop={`${padding}px solid rgb(115, 94, 255)`}
        borderLeft={`${padding}px solid transparent`}
        borderRight={`${padding}px solid transparent`}
        opacity={0.7}
      />
      <Box
        position="absolute"
        bottom={0}
        left={0}
        right={0}
        borderBottom={`${padding}px solid rgb(115, 94, 255)`}
        borderLeft={`${padding}px solid transparent`}
        borderRight={`${padding}px solid transparent`}
        opacity={0.7}
      />
    </>
  );
};

export default SectionsRenderView;
