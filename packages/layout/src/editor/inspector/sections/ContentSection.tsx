import { patchTextElement } from "../../../doc/edit";
import { DataBinding } from "../../../schema/document";
import { Section, TokenTextArea } from "../primitives";
import { TextSectionProps } from "./types";

export const ContentSection = ({
  doc,
  element,
  onChange,
  bindings,
}: TextSectionProps & { bindings: DataBinding[] }) => (
  <Section title="Content">
    <TokenTextArea
      value={element.content}
      onChange={(v) =>
        onChange(patchTextElement(doc, element.id, { content: v }))
      }
      knownKeys={bindings.map((b) => b.key)}
    />

    {bindings.length > 0 && (
      <div className="flex flex-wrap gap-1">
        {bindings.map((b) => (
          <button
            key={b.key}
            type="button"
            title={`Insert ${b.label}`}
            className="text-xs border border-stroke rounded px-1.5 py-0.5 cursor-pointer transition-colors hover:border-primary hover:bg-primary/10"
            onClick={() =>
              onChange(
                patchTextElement(doc, element.id, {
                  content: `${element.content}{{${b.key}}}`,
                }),
              )
            }
          >
            + {b.label}
          </button>
        ))}
      </div>
    )}
  </Section>
);
