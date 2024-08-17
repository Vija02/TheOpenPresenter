import { useLayoutEffect, useMemo, useRef, useState } from "react";

import { SlideStyle } from "../../../src";

type MWLSongRenderViewProps = {
  groupedData: Record<string, string[]>;
  heading: string;
  slideStyle: Required<SlideStyle>;
};

const MWLSongRenderView = ({
  groupedData,
  heading,
  slideStyle,
}: MWLSongRenderViewProps) => {
  const textRef = useRef<SVGTextElement>(null);

  const [size, setSize] = useState({ width: 0, height: 0 });

  const viewBox = useMemo(
    () => [0, 0, size.width, size.height].join(" "),
    [size.height, size.width],
  );

  useLayoutEffect(() => {
    setTimeout(() => {
      const el = textRef.current?.getBBox();
      if (el?.width === 0 || el?.height === 0) {
        return;
      }
      const state = size;
      const width = (el?.width ?? 0) + slideStyle.padding;
      const height = el?.height ?? 0;
      if (state.width !== width || state.height !== height) {
        setSize({
          width: width,
          height: height,
        });
      }
    }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heading, slideStyle.padding, textRef]);

  return (
    <svg
      viewBox={viewBox}
      xmlns="http://www.w3.org/2000/svg"
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: slideStyle.isDarkMode ? "black" : "transparent",
        overflow: "visible",
        userSelect: "none",
      }}
    >
      <text
        ref={textRef}
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
};

export default MWLSongRenderView;
