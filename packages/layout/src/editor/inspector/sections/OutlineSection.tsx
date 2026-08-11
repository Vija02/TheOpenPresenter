import { patchElement } from "../../../doc/edit";
import {
  Stroke,
  StrokeAlignment,
  solidPaint,
  strokeAlignments,
} from "../../../schema/paint";
import {
  ColorField,
  CompactNumberField,
  Row,
  Section,
  SelectField,
} from "../primitives";
import { SectionProps } from "./types";

/** Design units (1 = 1% of slide width). */
const DEFAULT_WIDTH = 0.2;
const DEFAULT_COLOR = "#000000";

const ALIGN_LABELS: Record<StrokeAlignment, string> = {
  inside: "Inside",
  center: "Centre",
  outside: "Outside",
};

const outlineStroke = (
  color: string,
  width: number,
  align: StrokeAlignment,
): Stroke => ({
  paint: solidPaint(color),
  width,
  align,
});

export const OutlineSection = ({ doc, element, onChange }: SectionProps) => {
  const id = element.id;
  const stroke = element.stroke;

  const color =
    stroke?.paint.type === "solid" ? stroke.paint.color : DEFAULT_COLOR;

  return (
    <Section title="Outline">
      <Row label="Outline">
        <SelectField
          value={stroke ? "on" : "none"}
          onChange={(v) =>
            onChange(
              patchElement(doc, id, {
                stroke:
                  v === "on"
                    ? outlineStroke(color, DEFAULT_WIDTH, "inside")
                    : null,
              }),
            )
          }
          options={[
            { value: "none", label: "None" },
            { value: "on", label: "Solid" },
          ]}
        />
      </Row>

      {stroke && (
        <>
          <Row label="Colour">
            <div className="flex min-w-0 items-center gap-2">
              <ColorField
                value={color}
                onChange={(v) =>
                  onChange(
                    patchElement(doc, id, {
                      stroke: { ...stroke, paint: solidPaint(v) },
                    }),
                  )
                }
              />
              <CompactNumberField
                value={stroke.width}
                min={0}
                max={5}
                label="Outline width"
                onChange={(v) =>
                  onChange(
                    patchElement(doc, id, { stroke: { ...stroke, width: v } }),
                  )
                }
              />
            </div>
          </Row>

          <Row label="Align">
            <SelectField
              value={stroke.align}
              onChange={(v) =>
                onChange(
                  patchElement(doc, id, {
                    stroke: { ...stroke, align: v as StrokeAlignment },
                  }),
                )
              }
              options={strokeAlignments.map((value) => ({
                value,
                label: ALIGN_LABELS[value],
              }))}
            />
          </Row>
        </>
      )}
    </Section>
  );
};
