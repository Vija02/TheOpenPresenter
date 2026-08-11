import { patchTextStyle } from "../../../doc/edit";
import { Shadow, Stroke, solidPaint } from "../../../schema/paint";
import {
  ColorField,
  CompactNumberField,
  Row,
  Section,
  SelectField,
} from "../primitives";
import { TextSectionProps } from "./types";

const shadow = (blur: number, color: string): Shadow => ({
  x: 0,
  y: 0,
  blur,
  spread: 0,
  color,
  inner: false,
});

const SHADOW_PRESETS: Record<string, Shadow[]> = {
  none: [],
  soft: [shadow(0.25, "rgba(0,0,0,0.9)")],
  strong: [shadow(0.25, "rgba(0,0,0,0.9)"), shadow(0.5, "rgba(0,0,0,0.6)")],
};

const DEFAULT_STROKE_WIDTH = 0.15;
const DEFAULT_STROKE_COLOR = "#000000";

const glyphStroke = (color: string, width: number): Stroke => ({
  paint: solidPaint(color),
  width,
  align: "center",
});

export const EffectsSection = ({
  doc,
  element,
  onChange,
}: TextSectionProps) => {
  const id = element.id;
  const stroke = element.style.outline;

  const current =
    element.style.shadows.length === 0
      ? "none"
      : element.style.shadows.length === 1
        ? "soft"
        : "strong";

  const strokeColor =
    stroke?.paint.type === "solid" ? stroke.paint.color : DEFAULT_STROKE_COLOR;

  return (
    <Section title="Text effects">
      <Row label="Shadow">
        <SelectField
          value={current}
          onChange={(v) =>
            onChange(
              patchTextStyle(doc, id, {
                shadows: SHADOW_PRESETS[v] ?? [],
              }),
            )
          }
          options={[
            { value: "none", label: "None" },
            { value: "soft", label: "Soft" },
            { value: "strong", label: "Strong" },
          ]}
        />
      </Row>

      <Row label="Stroke">
        <SelectField
          value={stroke ? "on" : "none"}
          onChange={(v) =>
            onChange(
              patchTextStyle(doc, id, {
                outline:
                  v === "on"
                    ? glyphStroke(strokeColor, DEFAULT_STROKE_WIDTH)
                    : null,
              }),
            )
          }
          options={[
            { value: "none", label: "None" },
            { value: "on", label: "Stroked" },
          ]}
        />
      </Row>

      {stroke && (
        <Row label="Stroke colour">
          <div className="flex min-w-0 items-center gap-2">
            <ColorField
              value={strokeColor}
              onChange={(v) =>
                onChange(
                  patchTextStyle(doc, id, {
                    outline: { ...stroke, paint: solidPaint(v) },
                  }),
                )
              }
            />
            <CompactNumberField
              value={stroke.width}
              min={0}
              max={2}
              label="Stroke width"
              onChange={(v) =>
                onChange(
                  patchTextStyle(doc, id, {
                    outline: { ...stroke, width: v },
                  }),
                )
              }
            />
          </div>
        </Row>
      )}
    </Section>
  );
};
