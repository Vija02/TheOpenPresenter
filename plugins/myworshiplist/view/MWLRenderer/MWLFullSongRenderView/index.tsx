import useSize from "@react-hook/size";
import React, { useMemo } from "react";

import { SlideStyle } from "../../../src/index.js";
// @ts-expect-error JS file
import partition from "../../partition.js";
import { getSvgMeasurement } from "./cache";

type MWLFullSongRenderViewProps = {
  groupedData: Record<string, string[]>;
  slideStyle: Required<SlideStyle>;
};

const MWLFullSongRenderView = React.memo(
  ({ groupedData, slideStyle }: MWLFullSongRenderViewProps) => {
    const target = React.useRef<any>(null);
    const [width, height] = useSize(target);

    // We measure everything first
    const groupMeasurements = useMemo(
      () =>
        Object.entries(groupedData).map(([heading, lines]) =>
          getSvgMeasurement({ slideStyle, heading, textLines: lines }),
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

    // Calculate how many columns this song should be displayed in
    const partitionNum = useMemo(
      () =>
        getPartition(
          { width, height },
          slideStyle,
          groupRawLengths,
          biggestWidth,
        ),
      [biggestWidth, groupRawLengths, height, slideStyle, width],
    );

    // Then we can calculate it and use the results
    // DEBT: We could reuse the calculated partition from above
    const partitionResult = useMemo(
      () => partition(groupRawLengths, partitionNum) as number[][],
      [groupRawLengths, partitionNum],
    );
    const rawHeightPerColumn = useMemo(
      () =>
        partitionResult.map((x) =>
          // 20 is the height of the text when it's 1rem. Our padding between headings is 2rem. Meaning it's 20px
          // We need to calculate this separately since measuring it individually doesn't include this padding
          x.concat([20 * x.length]).reduce((acc, val) => acc + val, 0),
        ),
      [partitionResult],
    );
    const maxHeight = useMemo(
      () => Math.max(...rawHeightPerColumn),
      [rawHeightPerColumn],
    );

    const partitionedData = useMemo(() => {
      const draft = [];

      let index = 0;
      const entries = Object.entries(groupedData);
      for (const res of partitionResult) {
        const newIndex = res.length;
        draft.push(entries.slice(index, index + newIndex));
        index += newIndex;
      }

      return draft;
    }, [groupedData, partitionResult]);

    return (
      <div ref={target} style={{ width: "100%", height: "100%" }}>
        <svg
          viewBox={[
            0,
            0,
            biggestWidth * partitionNum + slideStyle.padding,
            maxHeight,
          ].join(" ")}
          xmlns="http://www.w3.org/2000/svg"
          style={{
            width: "100%",
            height: "100%",
            backgroundColor: slideStyle.isDarkMode ? "black" : "white",
            overflow: "visible",
            userSelect: "none",
          }}
        >
          {partitionedData.map((partition, i) => {
            const xPosition = `${slideStyle.padding / 2 + biggestWidth * i}px`;
            return (
              <text
                key={i}
                x={xPosition}
                style={{
                  fontFamily: "inherit",
                  fontSize: "1rem",
                  fontWeight: slideStyle.fontWeight,
                }}
                fill={slideStyle.isDarkMode ? "white" : "rgb(26, 32, 44)"}
              >
                {partition.map(([heading, lines]) =>
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
                    lines.map((x, j) => (
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

export default MWLFullSongRenderView;

const getPartition = (
  { width, height }: { width: number; height: number },
  slideStyle: SlideStyle,
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

    const availableWidthPerColumn =
      (width - (slideStyle.padding ?? 0)) / currentPartition;
    const rawHeightPerColumn = partitionResult.map((x) =>
      x.concat([20 * x.length]).reduce((acc, val) => acc + val, 0),
    );

    const actualHeight = rawHeightPerColumn.map(
      (x) => (x * availableWidthPerColumn) / biggestWidth,
    );
    const maxHeight = Math.max(...actualHeight);

    if (maxHeight > height) {
      currentPartition++;
    } else {
      return currentPartition;
    }
  }
};
