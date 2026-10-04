import useSize from "@react-hook/size";
import type { StageMetrics } from "@repo/layout";
import { memo, useMemo, useState } from "react";

import {
  INK_COLORS,
  INK_POINT_STRIDE,
  INK_SIZES,
  type InkStroke,
  inkBox,
} from "../../src/ink";
import { usePluginAPI } from "../pluginApi";
import { useDisplayedSlide } from "../utils/useDisplayedSlide";
import { liveInkOn } from "./liveInk";
import { strokePath } from "./strokePath";

const NO_STROKES: InkStroke[] = [];

/** The speaker's marks over the slide being shown */
export const InkLayer = () => {
  const pluginApi = usePluginAPI();
  const { resolvedSlide } = useDisplayedSlide();
  const slideRef = resolvedSlide?.rawRef ?? null;
  // Selectors are path lookups only: the watcher records the path they read
  const strokes =
    pluginApi.renderer.useData((x) => x.ink?.[slideRef ?? ""]) ?? NO_STROKES;
  const awarenessData = pluginApi.awareness.useAwarenessData();
  const live = useMemo(
    () =>
      slideRef
        ? liveInkOn(
            awarenessData as Record<string, unknown>[],
            pluginApi.pluginContext.pluginId,
            slideRef,
          )
        : [],
    [awarenessData, pluginApi.pluginContext.pluginId, slideRef],
  );

  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const [width, height] = useSize(element);
  const box = resolvedSlide ? inkBox(resolvedSlide, width, height) : null;

  const hasInk = strokes.length > 0 || live.length > 0;
  // A finished stroke can arrive as kept before its live copy is cleared;
  // drawing both would darken a highlight for a moment
  const keptIds = useMemo(
    () => new Set(strokes.map((stroke) => stroke.id)),
    [strokes],
  );
  const viewBox = box ? `0 0 ${box.boxWidth} ${box.boxHeight}` : undefined;

  const shapes = (tool: InkStroke["tool"]) =>
    box && (
      <>
        {strokes
          .filter((stroke) => stroke.tool === tool)
          .map((stroke) => (
            <StrokeShape
              key={stroke.id}
              stroke={stroke}
              width={box.boxWidth}
              height={box.boxHeight}
              complete
            />
          ))}
        {live
          .filter(
            (ink) => ink.stroke?.tool === tool && !keptIds.has(ink.stroke.id),
          )
          .map((ink) => (
            <StrokeShape
              key={ink.stroke!.id}
              stroke={ink.stroke!}
              width={box.boxWidth}
              height={box.boxHeight}
              complete={false}
            />
          ))}
      </>
    );

  return (
    <div
      ref={setElement}
      data-testid="slides-ink-layer"
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
    >
      {box && box.boxWidth > 0 && hasInk && (
        <>
          <svg
            style={{ ...svgStyle(box), mixBlendMode: "multiply" }}
            viewBox={viewBox}
          >
            <g data-ink-tool="highlight">{shapes("highlight")}</g>
          </svg>
          <svg style={svgStyle(box)} viewBox={viewBox}>
            <g data-ink-tool="pencil">{shapes("pencil")}</g>
            <g data-ink-tool="laser">
              {live.map(
                (ink, i) =>
                  ink.laser &&
                  ink.laser.length > 0 && (
                    <LaserTrail
                      key={i}
                      points={ink.laser}
                      width={box.boxWidth}
                      height={box.boxHeight}
                    />
                  ),
              )}
            </g>
          </svg>
        </>
      )}
    </div>
  );
};

const StrokeShape = memo(
  ({
    stroke,
    width,
    height,
    complete,
  }: {
    stroke: InkStroke;
    width: number;
    height: number;
    complete: boolean;
  }) => {
    const d = useMemo(
      () =>
        strokePath({
          tool: stroke.tool,
          points: stroke.points,
          hasPressure: stroke.hasPressure,
          width,
          height,
          complete,
        }),
      [stroke, width, height, complete],
    );
    return <path d={d} fill={stroke.color} />;
  },
);

const svgStyle = (box: StageMetrics): React.CSSProperties => ({
  position: "absolute",
  left: box.offsetX,
  top: box.offsetY,
  width: box.boxWidth,
  height: box.boxHeight,
  overflow: "visible",
});

const LaserTrail = ({
  points,
  width,
  height,
}: {
  points: number[];
  width: number;
  height: number;
}) => {
  const d = useMemo(
    () =>
      strokePath({
        tool: "laser",
        points,
        hasPressure: false,
        width,
        height,
        complete: false,
      }),
    [points, width, height],
  );
  // The head: shows where the pointer is even when it holds still
  const headX = points[points.length - INK_POINT_STRIDE]! * width;
  const headY = points[points.length - INK_POINT_STRIDE + 1]! * height;
  const headRadius = (INK_SIZES.laser * width) / 2;
  return (
    <>
      {/* Glow, then the bright core */}
      <g
        fill={INK_COLORS.laser}
        opacity={0.35}
        style={{ filter: `blur(${Math.max(2, width * 0.004)}px)` }}
      >
        <path d={d} />
        <circle cx={headX} cy={headY} r={headRadius * 1.6} />
      </g>
      <g fill={INK_COLORS.laser}>
        <path d={d} />
        <circle cx={headX} cy={headY} r={headRadius} />
      </g>
    </>
  );
};
