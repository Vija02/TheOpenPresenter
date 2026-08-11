import { patchElement } from "../../../doc/edit";
import { NumberField, Row, Section } from "../primitives";
import { SectionProps } from "./types";

export const AppearanceSection = ({ doc, element, onChange }: SectionProps) => {
  const id = element.id;

  return (
    <Section title="Appearance">
      <Row label="Radius">
        <NumberField
          value={element.radius}
          min={0}
          max={50}
          step={0.1}
          onChange={(v) => onChange(patchElement(doc, id, { radius: v }))}
        />
      </Row>

      <Row label="Opacity">
        <NumberField
          value={element.opacity * 100}
          min={0}
          max={100}
          step={1}
          onChange={(v) =>
            onChange(
              patchElement(doc, id, {
                opacity: Math.max(0, Math.min(1, v / 100)),
              }),
            )
          }
        />
      </Row>
    </Section>
  );
};
