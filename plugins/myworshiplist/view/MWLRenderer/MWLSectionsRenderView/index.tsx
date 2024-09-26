import React, { useMemo } from "react";

import { SlideStyle } from "../../../src";
import { getSvgMeasurement } from "./cache";

type MWLSectionsRenderViewProps = {
  groupedData: Record<string, string[]>;
  heading: string;
  slideStyle: Required<SlideStyle>;
};

const MWLSectionsRenderView = React.memo(
  ({ groupedData, heading, slideStyle }: MWLSectionsRenderViewProps) => {
    const measuredData = useMemo(
      () =>
        getSvgMeasurement({ slideStyle, textLines: groupedData![heading]! }),
      [groupedData, heading, slideStyle],
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
          {groupedData?.[heading]?.map((x, i) => (
            <tspan key={i} x="50%" dy="1em">
              {x}
            </tspan>
          ))}
        </text>
      </svg>
    );
  },
);

export default MWLSectionsRenderView;
