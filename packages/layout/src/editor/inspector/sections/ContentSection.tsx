import type { DataBinding } from "@repo/base-types";

import { docFeeds, patchTextElement } from "../../../doc/edit";
import { useHostCatalog } from "../../../react/context/hostCatalog";
import { LayoutDoc } from "../../../schema/document";
import { feedTokenKey } from "../../../schema/feed";
import { Section, TokenTextArea } from "../primitives";
import { TextSectionProps } from "./types";

/** The plugin's own bindings, plus each feed's bindings namespaced. */
const useTokenChips = (
  doc: LayoutDoc,
  bindings: DataBinding[],
): { key: string; label: string }[] => {
  const catalog = useHostCatalog();

  const chips = bindings.map((b) => ({ key: b.key, label: b.label }));

  for (const feed of docFeeds(doc)) {
    for (const binding of catalog.dataBindings?.(feed.source) ?? []) {
      chips.push({
        key: feedTokenKey(feed.name, binding.key),
        label: `${feed.name}: ${binding.label}`,
      });
    }
  }

  return chips;
};

export const ContentSection = ({
  doc,
  element,
  onChange,
  bindings,
}: TextSectionProps & { bindings: DataBinding[] }) => {
  const chips = useTokenChips(doc, bindings);

  return (
    <Section title="Content">
      <TokenTextArea
        value={element.content}
        onChange={(v) =>
          onChange(patchTextElement(doc, element.id, { content: v }))
        }
        knownKeys={chips.map((c) => c.key)}
      />

      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              title={`Insert ${chip.label}`}
              className="text-xs border border-stroke rounded px-1.5 py-0.5 cursor-pointer transition-colors hover:border-primary hover:bg-primary/10"
              onClick={() =>
                onChange(
                  patchTextElement(doc, element.id, {
                    content: `${element.content}{{${chip.key}}}`,
                  }),
                )
              }
            >
              + {chip.label}
            </button>
          ))}
        </div>
      )}
    </Section>
  );
};
