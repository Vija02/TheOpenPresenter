import { patchTextStyle } from "../../../doc/edit";
import { Shadow } from "../../../schema/paint";
import { Row, Section, SelectField } from "../primitives";
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

export const EffectsSection = ({
  doc,
  element,
  onChange,
}: TextSectionProps) => {
  const current =
    element.style.shadows.length === 0
      ? "none"
      : element.style.shadows.length === 1
        ? "soft"
        : "strong";

  return (
    <Section title="Effects">
      <Row label="Shadow">
        <SelectField
          value={current}
          onChange={(v) =>
            onChange(
              patchTextStyle(doc, element.id, {
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
    </Section>
  );
};
