import { CSSProperties, useMemo, useSyncExternalStore } from "react";

import { StageMetrics, rectToPx, toPx } from "../../geometry/scale";
import { SpanRoleStyle } from "../../schema/style";
import { ResolvedTextElement } from "../../template/resolve";
import {
  ElementPlacement,
  appearanceToCss,
  placementToCss,
  textStyleToCss,
} from "../css";
import {
  getFontGeneration,
  getServerFontGeneration,
  subscribeToFonts,
} from "../text/fontStatus";
import { fitFontSize, spansToHtml } from "../text/measure";

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

  const fontSize = useMemo(() => {
    if (element.fit === "declared") return toPx(style.fontSize, metrics);
    return fitFontSize({
      html: spansToHtml(spans, spanRoles),
      width: box.width,
      height: box.height,
      fontFamily: style.fontFamily,
      fontWeight: style.fontWeight,
      fontStyle: style.fontStyle,
      lineHeight: style.lineHeight,
      letterSpacing: toPx(style.letterSpacing, metrics),
    });
  }, [
    element.fit,
    spans,
    spanRoles,
    style,
    box.width,
    box.height,
    metrics,
    fontGeneration,
  ]);

  return (
    <div
      style={{
        ...placementToCss(placement, element.rect),
        display: "flex",
        flexDirection: "column",
        ...appearanceToCss(element, metrics),
        ...textStyleToCss(style, metrics),
        fontSize,
      }}
    >
      <div className="lay--text-content" style={{ width: "100%" }}>
        {spans.map((s, i) => (
          <span
            key={i}
            style={s.role !== null ? spanStyle(spanRoles?.[s.role]) : undefined}
          >
            {s.text}
          </span>
        ))}
      </div>
    </div>
  );
};
