import { getSolidFillColor, setElementFill } from "../../../doc/edit";
import { solidPaint } from "../../../schema/paint";
import { ColorField, Row, Section } from "../primitives";
import { SectionProps } from "./types";

export const FillSection = ({ doc, element, onChange }: SectionProps) => (
  <Section title="Fill">
    <Row label="Colour">
      <ColorField
        alpha
        value={getSolidFillColor(doc, element.id)}
        onChange={(v) =>
          onChange(setElementFill(doc, element.id, solidPaint(v)))
        }
      />
    </Row>
  </Section>
);
