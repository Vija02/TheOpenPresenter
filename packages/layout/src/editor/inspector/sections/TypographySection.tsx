import {
  LuCaseLower,
  LuCaseSensitive,
  LuCaseUpper,
  LuLink,
  LuUnlink,
} from "react-icons/lu";
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
  MiniRow,
  NumberField,
  Row,
  Section,
  SelectField,
  ToggleGroupField,
} from "../primitives";
import { TextSectionProps } from "./types";

const PADDING_SIDES = [
  { key: "paddingTop", label: "T" },
  { key: "paddingRight", label: "R" },
  { key: "paddingBottom", label: "B" },
  { key: "paddingLeft", label: "L" },
] as const;

export const TypographySection = ({
  doc,
  element,
  onChange,
}: TextSectionProps) => {
  const id = element.id;
  const s = element.style;
  const linked = s.paddingIsLinked ?? true;

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
                : m === "shrinkToFit"
                  ? "Shrink to fit"
                  : m === "fitNoWrap"
                    ? "Fit (no wrap)"
                    : "Wrap and fit",
          }))}
        />
      </Row>

      {/*
        `fitNoWrap` and `wrap` derive the size by measurement, so it would
        be a dead knob. `declared` uses it verbatim; `shrinkToFit` uses it as a
        ceiling, hence the different label.
      */}
      {(element.fit === "declared" || element.fit === "shrinkToFit") && (
        <Row label={element.fit === "shrinkToFit" ? "Max size" : "Size"}>
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

      <Row label="Case">
        <ToggleGroupField
          value={s.textTransform ?? "none"}
          onChange={(v) =>
            onChange(patchTextStyle(doc, id, { textTransform: v }))
          }
          options={[
            { value: "none", label: "As typed", icon: <LuCaseSensitive /> },
            { value: "uppercase", label: "UPPERCASE", icon: <LuCaseUpper /> },
            { value: "lowercase", label: "lowercase", icon: <LuCaseLower /> },
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

      <Row label="Padding">
        <div className="flex min-w-0 items-center gap-1">
          {linked ? (
            <NumberField
              value={s.padding ?? 0}
              min={0}
              max={20}
              step={0.1}
              onChange={(v) =>
                onChange(patchTextStyle(doc, id, { padding: v }))
              }
            />
          ) : (
            <span className="text-2xs text-secondary">Per side</span>
          )}
          <button
            type="button"
            title={linked ? "Padding linked" : "Padding per side"}
            aria-label={linked ? "Padding linked" : "Padding per side"}
            aria-pressed={linked}
            onClick={() =>
              onChange(patchTextStyle(doc, id, { paddingIsLinked: !linked }))
            }
            className={`grid size-6 shrink-0 place-items-center rounded hover:bg-surface-secondary-hover ${
              linked ? "text-primary" : "text-secondary"
            }`}
          >
            {linked ? <LuLink size={13} /> : <LuUnlink size={13} />}
          </button>
        </div>
      </Row>

      {!linked && (
        <div className="grid grid-cols-2 gap-2">
          {PADDING_SIDES.map(({ key, label }) => (
            <MiniRow key={key} label={label}>
              <NumberField
                value={s[key] ?? 0}
                min={0}
                max={20}
                step={0.1}
                onChange={(v) =>
                  onChange(patchTextStyle(doc, id, { [key]: v }))
                }
              />
            </MiniRow>
          ))}
        </div>
      )}
    </Section>
  );
};
