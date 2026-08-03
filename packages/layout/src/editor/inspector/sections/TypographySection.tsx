import {
  TbAlignCenter,
  TbAlignLeft,
  TbAlignRight,
  TbLayoutAlignBottom,
  TbLayoutAlignMiddle,
  TbLayoutAlignTop,
} from "react-icons/tb";

import { patchTextElement, patchTextStyle } from "../../../doc/edit";
import { TextElement } from "../../../schema/element";
import { textFitModes } from "../../../schema/style";
import {
  ColorField,
  FontField,
  NumberField,
  Row,
  Section,
  SelectField,
  ToggleGroupField,
} from "../primitives";
import { TextSectionProps } from "./types";

export const TypographySection = ({
  doc,
  element,
  onChange,
}: TextSectionProps) => {
  const id = element.id;
  const s = element.style;

  return (
    <Section title="Typography">
      <Row label="Font">
        <FontField
          value={s.fontFamily}
          onChange={(v) => onChange(patchTextStyle(doc, id, { fontFamily: v }))}
        />
      </Row>

      <Row label="Auto-size">
        <SelectField
          value={element.fit}
          onChange={(v) =>
            onChange(
              patchTextElement(doc, id, { fit: v as TextElement["fit"] }),
            )
          }
          options={textFitModes.map((m) => ({
            value: m,
            label:
              m === "declared"
                ? "Fixed size"
                : m === "shrink"
                  ? "Shrink (no wrap)"
                  : "Wrap and fit",
          }))}
        />
      </Row>

      {/*
        Only `declared` reads style.fontSize; `shrink` and `wrap` derive it by
        measurement. Showing the control in those modes would be a dead knob.
      */}
      {element.fit === "declared" && (
        <Row label="Size">
          <NumberField
            value={s.fontSize}
            min={0.5}
            max={30}
            step={0.1}
            onChange={(v) => onChange(patchTextStyle(doc, id, { fontSize: v }))}
          />
        </Row>
      )}

      <Row label="Weight">
        <SelectField
          value={s.fontWeight}
          onChange={(v) =>
            onChange(patchTextStyle(doc, id, { fontWeight: parseInt(v, 10) }))
          }
          options={[
            { value: 400, label: "Normal" },
            { value: 600, label: "Semi-bold" },
            { value: 700, label: "Bold" },
          ]}
        />
      </Row>

      <Row label="Colour">
        <ColorField
          value={s.color}
          onChange={(v) => onChange(patchTextStyle(doc, id, { color: v }))}
        />
      </Row>

      <Row label="Align">
        <ToggleGroupField
          value={s.align}
          onChange={(v) => onChange(patchTextStyle(doc, id, { align: v }))}
          options={[
            { value: "left", label: "Align left", icon: <TbAlignLeft /> },
            { value: "center", label: "Align centre", icon: <TbAlignCenter /> },
            { value: "right", label: "Align right", icon: <TbAlignRight /> },
          ]}
        />
      </Row>

      <Row label="V-align">
        <ToggleGroupField
          value={s.valign}
          onChange={(v) => onChange(patchTextStyle(doc, id, { valign: v }))}
          options={[
            { value: "top", label: "Align top", icon: <TbLayoutAlignTop /> },
            {
              value: "center",
              label: "Align middle",
              icon: <TbLayoutAlignMiddle />,
            },
            {
              value: "bottom",
              label: "Align bottom",
              icon: <TbLayoutAlignBottom />,
            },
          ]}
        />
      </Row>

      <Row label="Line height">
        <NumberField
          value={s.lineHeight}
          min={0.5}
          max={3}
          step={0.05}
          onChange={(v) => onChange(patchTextStyle(doc, id, { lineHeight: v }))}
        />
      </Row>
    </Section>
  );
};
