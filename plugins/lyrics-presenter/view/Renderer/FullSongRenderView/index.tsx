import useSize from "@react-hook/size";
import React, { useMemo } from "react";

import { SlideStyle } from "../../../src/index.js";
import { GroupedData } from "../../../src/processLyrics";
// @ts-expect-error JS file
import partition from "../../partition.js";
import { DebugPadding } from "../DebugPadding.js";
import { usePadding } from "../usePadding";
import { getSvgMeasurement } from "./cache";

type FullSongRenderViewProps = {
  groupedData: GroupedData;
  slideStyle: Required<SlideStyle>;
};

// TODO: Optimize based on font size rather than horizontally. 
// (Because column widths can be quite different, making us lose precious space)
const FullSongRenderView = React.memo(
  ({ groupedData, slideStyle }: FullSongRenderViewProps) => {
    const target = React.useRef<any>(null);
    const [width, height] = useSize(target);

    // We measure everything first
    const groupMeasurements = useMemo(
      () =>
        groupedData.map(({ heading, slides }) =>
          getSvgMeasurement({ slideStyle, heading, textLines: slides.flat() }),
        ),
      [groupedData, slideStyle],
    );

    // This will be used to scale things properly
    const biggestWidth = useMemo(
      () => Math.max(...groupMeasurements.map((x) => x.width)),
      [groupMeasurements],
    );

    const groupRawLengths = useMemo(
      () => groupMeasurements.map((measurements) => measurements.height),
      [groupMeasurements],
    );

    // Calculate how many columns this song should be displayed in and some other info
    const { partitionNum, partitionResult, maxRawHeight } = useMemo(
      () => getPartition({ width, height }, groupRawLengths, biggestWidth),
      [biggestWidth, groupRawLengths, height, width],
    );

    const partitionedData = useMemo(() => {
      const draft = [];

      let index = 0;
      for (const res of partitionResult) {
        const newIndex = res.length;
        draft.push(groupedData.slice(index, index + newIndex));
        index += newIndex;
      }

      return draft;
    }, [groupedData, partitionResult]);

    const padding = usePadding(slideStyle, { width, height });

    // TODO: Calculate and handle line height
    return (
      <div
        ref={target}
        style={{
          width: "100%",
          height: "100%",
          position: "relative",
          backgroundColor: slideStyle.isDarkMode ? "black" : "white",
        }}
      >
        {slideStyle.debugPadding && <DebugPadding padding={padding} />}
        <svg
          viewBox={[0, 0, biggestWidth * partitionNum, maxRawHeight].join(" ")}
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
          {partitionedData.map((partition, i) => {
            const xPosition = `${biggestWidth * i}px`;
            return (
              <text
                key={i}
                x={xPosition}
                style={{
                  fontSize: "1rem",
                  fontWeight: slideStyle.fontWeight,
                  fontStyle: slideStyle.fontStyle,
                  fontFamily: slideStyle.fontFamily,
                }}
                fill={slideStyle.isDarkMode ? "white" : "rgb(26, 32, 44)"}
              >
                {partition.map(({ heading, slides }) =>
                  [
                    <tspan
                      key="heading"
                      x={xPosition}
                      dy="2rem"
                      fontSize="0.6rem"
                    >
                      {heading}
                    </tspan>,
                  ].concat(
                    slides.flat().map((x, j) => (
                      <tspan
                        key={j}
                        x={xPosition}
                        dy={j === 0 ? "1.2rem" : "1rem"}
                      >
                        {x}
                      </tspan>
                    )),
                  ),
                )}
              </text>
            );
          })}
        </svg>
      </div>
    );
  },
);

export default FullSongRenderView;

const getPartition = (
  { width, height }: { width: number; height: number },
  groupRawLengths: number[],
  biggestWidth: number,
) => {
  let currentPartition = 1;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const partitionResult = partition(
      groupRawLengths,
      currentPartition,
    ) as number[][];

    const availableWidthPerColumn = width / currentPartition;
    const rawHeightPerColumn = partitionResult.map((x) =>
      // 20 is the height of the text when it's 1rem. Our padding between headings is 2rem. Meaning it's 20px
      // We need to calculate this separately since measuring it individually doesn't include this padding
      x.concat([20 * x.length]).reduce((acc, val) => acc + val, 0),
    );
    const maxRawHeight = Math.max(...rawHeightPerColumn);

    const actualHeight = rawHeightPerColumn.map(
      (x) => (x * availableWidthPerColumn) / biggestWidth,
    );
    const maxActualHeight = Math.max(...actualHeight);

    if (maxActualHeight > height) {
      currentPartition++;
    } else {
      return {
        partitionNum: currentPartition,
        partitionResult,
        rawHeightPerColumn,
        maxActualHeight,
        maxRawHeight,
      };
    }
  }
};
