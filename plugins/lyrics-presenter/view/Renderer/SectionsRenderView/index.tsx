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

  return <SectionsRenderViewInner {...props} />;
};

const SectionsRenderViewInner = React.memo(
  ({ groupedData, currentIndex, slideStyle }: SectionsRenderViewProps) => {
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

    const measuredData = useMemo(
      () =>
        getSvgMeasurement({
          slideStyle,
          textLines,
        }),
      [slideStyle, textLines],
    );

    const viewBox = useMemo(
      () =>
        [
          0,
          0,
          measuredData.width + slideStyle.padding,
          measuredData.height,
        ].join(" "),
      [measuredData.height, measuredData.width, slideStyle.padding],
    );

    return (
      <svg
        viewBox={viewBox}
        xmlns="http://www.w3.org/2000/svg"
        style={{
          width: "100%",
          height: "100%",
          backgroundColor: slideStyle.isDarkMode ? "black" : "white",
          overflow: "visible",
          userSelect: "none",
        }}
      >
        <text
          x="50%"
          style={{
            fontFamily: "inherit",
            fontSize: "1rem",
            fontWeight: slideStyle.fontWeight,
            textAnchor: "middle",
          }}
          fill={slideStyle.isDarkMode ? "white" : "rgb(26, 32, 44)"}
        >
          {textLines?.map((x, i) => (
            <tspan key={i} x="50%" dy="1em">
              {x}
            </tspan>
          ))}
        </text>
      </svg>
    );
  },
);

export default SectionsRenderView;
