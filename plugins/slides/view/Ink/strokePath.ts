import { type StrokeOptions, getStroke } from "perfect-freehand";

import { INK_POINT_STRIDE, INK_SIZES, type InkTool } from "../../src/ink";

const TOOL_OPTIONS: Record<InkTool, StrokeOptions> = {
  pencil: { thinning: 0.5, smoothing: 0.5, streamline: 0.5 },
  highlight: { thinning: 0, smoothing: 0.5, streamline: 0.5 },
  laser: {
    thinning: 0,
    smoothing: 0.5,
    streamline: 0.4,
    start: { taper: true },
  },
};

export const strokePath = ({
  tool,
  points,
  hasPressure,
  width,
  height,
  complete,
}: {
  tool: InkTool;
  points: number[];
  hasPressure: boolean;
  width: number;
  height: number;
  /** The stroke is finished, so its end is drawn as an end */
  complete: boolean;
}): string => {
  const input: number[][] = [];
  for (
    let i = 0;
    i + INK_POINT_STRIDE <= points.length;
    i += INK_POINT_STRIDE
  ) {
    input.push([points[i]! * width, points[i + 1]! * height, points[i + 2]!]);
  }
  if (input.length === 0) return "";

  const outline = getStroke(input, {
    ...TOOL_OPTIONS[tool],
    size: INK_SIZES[tool] * width,
    simulatePressure: !hasPressure,
    last: complete,
  });
  return svgPathFromOutline(outline);
};

// From perfect-freehand's README: a smooth closed path through the outline
const average = (a: number, b: number) => (a + b) / 2;

const svgPathFromOutline = (outline: number[][]): string => {
  const len = outline.length;
  if (len < 4) return "";

  let a = outline[0]!;
  let b = outline[1]!;
  const c = outline[2]!;
  let result = `M${a[0]!.toFixed(2)},${a[1]!.toFixed(2)} Q${b[0]!.toFixed(2)},${b[1]!.toFixed(2)} ${average(b[0]!, c[0]!).toFixed(2)},${average(b[1]!, c[1]!).toFixed(2)} T`;

  for (let i = 2; i < len - 1; i++) {
    a = outline[i]!;
    b = outline[i + 1]!;
    result += `${average(a[0]!, b[0]!).toFixed(2)},${average(a[1]!, b[1]!).toFixed(2)} `;
  }
  return result + "Z";
};
