import { Button } from "@repo/ui";
import { LuCopy, LuTrash2 } from "react-icons/lu";

import { duplicateElement, elementLabel, removeElement } from "../../doc/edit";
import { DataBinding, LayoutDoc } from "../../schema/document";
import { LayoutElement } from "../../schema/element";
import {
  ContentSection,
  EffectsSection,
  FillSection,
  LayerSection,
  PositionSection,
  TypographySection,
} from "./sections";

export type ElementInspectorProps = {
  doc: LayoutDoc;
  element: LayoutElement;
  onChange: (doc: LayoutDoc) => void;
  onSelectionChange: (ids: string[]) => void;
  /** Tokens the data provider offers, rendered as insert chips. */
  bindings?: DataBinding[];
};

/**
 * Property controls for a single selected element.
 */
export const ElementInspector = ({
  doc,
  element,
  onChange,
  onSelectionChange,
  bindings = [],
}: ElementInspectorProps) => (
  <>
    <div className="flex items-center justify-between py-2">
      <span className="text-xs font-semibold uppercase tracking-wide">
        {elementLabel(element)}
      </span>
      <div className="flex gap-1">
        <Button
          type="button"
          size="icon"
          variant="outline"
          title="Duplicate"
          className="size-7"
          onClick={() => {
            const result = duplicateElement(doc, element.id);
            onChange(result.doc);
            // Select the copy after duplicating
            if (result.id) onSelectionChange([result.id]);
          }}
        >
          <LuCopy size={14} />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="destructive"
          title="Delete"
          className="size-7"
          onClick={() => {
            onChange(removeElement(doc, element.id));
            onSelectionChange([]);
          }}
        >
          <LuTrash2 size={14} />
        </Button>
      </div>
    </div>

    {element.type === "text" && (
      <>
        <ContentSection
          doc={doc}
          element={element}
          onChange={onChange}
          bindings={bindings}
        />
        <TypographySection doc={doc} element={element} onChange={onChange} />
        <EffectsSection doc={doc} element={element} onChange={onChange} />
      </>
    )}

    {element.type === "shape" && (
      <FillSection doc={doc} element={element} onChange={onChange} />
    )}

    <PositionSection doc={doc} element={element} onChange={onChange} />
    <LayerSection doc={doc} element={element} onChange={onChange} />
  </>
);
