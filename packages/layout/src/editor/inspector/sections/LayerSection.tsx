import { elementLabel, patchElement, reorderElement } from "../../../doc/edit";
import { CheckField, Row, Section, TextField } from "../primitives";
import { SectionProps } from "./types";

const REORDER_ACTIONS = [
  ["back", "To back"],
  ["backward", "Backward"],
  ["forward", "Forward"],
  ["front", "To front"],
] as const;

/** Name, paint order and visibility. Collapsed by default — rarely touched. */
export const LayerSection = ({ doc, element, onChange }: SectionProps) => (
  <Section title="Layer" defaultOpen={false}>
    <Row label="Name">
      <TextField
        value={element.name ?? ""}
        placeholder={elementLabel(element)}
        // Empty means "no custom name", which must be null and not "" so the
        // label falls back to the type-derived one.
        onChange={(v) =>
          onChange(patchElement(doc, element.id, { name: v.trim() || null }))
        }
      />
    </Row>

    <div className="grid grid-cols-2 gap-1">
      {REORDER_ACTIONS.map(([dir, label]) => (
        <button
          key={dir}
          type="button"
          className="text-xs border border-stroke rounded px-2 py-1 cursor-pointer transition-colors hover:border-primary hover:bg-primary/10"
          onClick={() => onChange(reorderElement(doc, element.id, dir))}
        >
          {label}
        </button>
      ))}
    </div>

    <CheckField
      label="Hidden"
      checked={element.hidden}
      onChange={(v) => onChange(patchElement(doc, element.id, { hidden: v }))}
    />
  </Section>
);
