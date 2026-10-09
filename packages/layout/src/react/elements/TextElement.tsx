import { CSSProperties, useMemo, useSyncExternalStore } from "react";

import { StageMetrics, rectToPx, toPx } from "../../geometry/scale";
import {
  SpanRoleStyle,
  resolveColumns,
  resolvePadding,
} from "../../schema/style";
import { ResolvedTextElement } from "../../template/resolve";
import { Span } from "../../template/spans";
import { spansToBlocks } from "../../text/columns";
import {
  ElementPlacement,
  appearanceToCss,
  placementToCss,
  textStyleToCss,
} from "../css";
import {
  EMPTY_ANNOTATED_TEXT,
  annotatedStyle,
  annotatedTextStyle,
  annotationStyle,
} from "../text/annotation";
import {
  blockStartStyle,
  columnRowStyle,
  fitColumns,
  startsBlock,
} from "../text/columns";
import {
  getFontGeneration,
  getServerFontGeneration,
  subscribeToFonts,
} from "../text/fontStatus";
import { fitFontSize, spansToHtml } from "../text/measure";
import { FillLayer } from "./FillLayer";

const spanStyle = (role: SpanRoleStyle | undefined): CSSProperties => {
  if (!role) return {};
  return {
    fontSize: role.fontScale !== undefined ? `${role.fontScale}em` : undefined,
    verticalAlign: role.verticalAlign,
    fontWeight: role.fontWeight,
    fontStyle: role.fontStyle,
    fontFamily: role.fontFamily,
    color: role.color,
    opacity: role.opacity,
    marginRight:
      role.marginAfter !== undefined ? `${role.marginAfter}em` : undefined,
  };
};

const renderSpans = (
  spans: Span[],
  roles: Record<string, SpanRoleStyle> | null,
) =>
  spans.map((s, i) => {
    const text = (
      <span
        key={s.above ? undefined : i}
        style={s.role !== null ? spanStyle(roles?.[s.role]) : undefined}
      >
        {s.above ? s.text || EMPTY_ANNOTATED_TEXT : s.text}
      </span>
    );
    if (!s.above) return text;

    // Mirrors `spansToHtml`, so the fit measures what is drawn
    return (
      <span key={i} style={annotatedStyle}>
        <span
          style={annotationStyle(
            s.above.role !== null ? roles?.[s.above.role] : undefined,
          )}
        >
          {s.above.text}
        </span>
        <span style={annotatedTextStyle}>{text}</span>
      </span>
    );
  });

export type TextElementViewProps = {
  element: ResolvedTextElement;
  metrics: StageMetrics;
  placement?: ElementPlacement;
};

export const TextElementView = ({
  element,
  metrics,
  placement = "rect",
}: TextElementViewProps) => {
  // Pixels are needed for the fit measurement only, never for placement.
  const box = rectToPx(element.rect, metrics);
  const { style, spans, spanRoles } = element;

  const fontGeneration = useSyncExternalStore(
    subscribeToFonts,
    getFontGeneration,
    getServerFontGeneration,
  );

  const noWrap = element.fit === "fitNoWrap";

  const columnGap = toPx(resolveColumns(style).columnGap, metrics);

  const columns = useMemo(() => {
    if (element.fit !== "columns") return null;

    const [top, right, bottom, left] = resolvePadding(style);
    const blocks = spansToBlocks(spans);

    return {
      blocks,
      ...fitColumns({
        blocks,
        roles: spanRoles,
        width: Math.max(0, box.width - toPx(left + right, metrics)),
        height: Math.max(0, box.height - toPx(top + bottom, metrics)),
        fontFamily: style.fontFamily,
        fontWeight: style.fontWeight,
        fontStyle: style.fontStyle,
        lineHeight: style.lineHeight,
        letterSpacing: toPx(style.letterSpacing, metrics),
        textTransform: style.textTransform ?? "none",
        columnGap,
        maxColumns: resolveColumns(style).maxColumns,
      }),
    };
  }, [
    element.fit,
    spans,
    spanRoles,
    style,
    box.width,
    box.height,
    metrics,
    fontGeneration,
    columnGap,
  ]);

  const fontSize = useMemo(() => {
    if (columns) return columns.fontSize;
    if (element.fit === "declared") return toPx(style.fontSize, metrics);

    const [top, right, bottom, left] = resolvePadding(style);

    return fitFontSize(
      {
        html: spansToHtml(spans, spanRoles),
        width: Math.max(0, box.width - toPx(left + right, metrics)),
        height: Math.max(0, box.height - toPx(top + bottom, metrics)),
        fontFamily: style.fontFamily,
        fontWeight: style.fontWeight,
        fontStyle: style.fontStyle,
        lineHeight: style.lineHeight,
        letterSpacing: toPx(style.letterSpacing, metrics),
        noWrap,
        textTransform: style.textTransform ?? "none",
      },
      element.fit === "shrinkToFit"
        ? { maxFontSize: toPx(style.fontSize, metrics) }
        : undefined,
    );
  }, [
    element.fit,
    spans,
    spanRoles,
    style,
    box.width,
    box.height,
    metrics,
    fontGeneration,
    noWrap,
    columns,
  ]);

  return (
    <div
      style={{
        ...placementToCss(placement, element.rect, element.rotation),
        display: "flex",
        flexDirection: "column",
        isolation: "isolate",
        ...appearanceToCss(element, metrics),
        ...textStyleToCss(style, metrics),
        fontSize,
      }}
    >
      <FillLayer fill={element.fill} width={box.width} elementId={element.id} />

      {columns ? (
        // Structure mirrors the measure node in `text/columns.ts`.
        <div
          className="lay--text-content"
          style={{
            width: "100%",
            whiteSpace: "pre",
            position: "relative",
            zIndex: 1,
            ...columnRowStyle(columnGap),
          }}
        >
          {columns.columns.map((column, c) => (
            <div
              key={c}
              className="lay--text-column"
              // Natural width plus an even share of the slack, so `align`
              // applies within each column.
              style={{ flex: "1 0 auto" }}
            >
              {column.map((ref, i) => (
                <div
                  key={i}
                  style={
                    startsBlock(column, i)
                      ? blockStartStyle(style.lineHeight)
                      : undefined
                  }
                >
                  {renderSpans(
                    columns.blocks[ref.block]![ref.line]!,
                    spanRoles,
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div
          className="lay--text-content"
          style={{
            width: "100%",
            whiteSpace: noWrap ? "pre" : "pre-wrap",
            overflowWrap: "break-word",
            position: "relative",
            zIndex: 1,
          }}
        >
          {renderSpans(spans, spanRoles)}
        </div>
      )}
    </div>
  );
};
