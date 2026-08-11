import { patchElement, patchRect } from "../../../doc/edit";
import { normalizeRotation } from "../../../geometry/rect";
import { MiniRow, NumberField, Row, Section } from "../primitives";
import { SectionProps } from "./types";

export const PositionSection = ({ doc, element, onChange }: SectionProps) => {
  const id = element.id;
  const r = element.rect;

  return (
    <Section title="Position & size">
      <div className="grid grid-cols-2 gap-2">
        <MiniRow label="X">
          <NumberField
            value={r.x}
            step={0.5}
            onChange={(v) => onChange(patchRect(doc, id, { x: v }))}
          />
        </MiniRow>
        <MiniRow label="Y">
          <NumberField
            value={r.y}
            step={0.5}
            onChange={(v) => onChange(patchRect(doc, id, { y: v }))}
          />
        </MiniRow>
        <MiniRow label="W">
          <NumberField
            value={r.w}
            step={0.5}
            onChange={(v) => onChange(patchRect(doc, id, { w: v }))}
          />
        </MiniRow>
        <MiniRow label="H">
          <NumberField
            value={r.h}
            step={0.5}
            onChange={(v) => onChange(patchRect(doc, id, { h: v }))}
          />
        </MiniRow>
      </div>

      <Row label="Rotation">
        <NumberField
          value={element.rotation}
          step={1}
          onChange={(v) =>
            onChange(patchElement(doc, id, { rotation: normalizeRotation(v) }))
          }
        />
      </Row>
    </Section>
  );
};
