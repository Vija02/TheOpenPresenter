import { useEffect, useState } from "react";

import {
  addFeed,
  docFeeds,
  patchFeed,
  removeFeed,
  renameFeed,
} from "../../../doc/edit";
import {
  findSourceOption,
  useHostCatalog,
} from "../../../react/context/hostCatalog";
import { Derivation } from "../../../schema/derivation";
import { LayoutDoc } from "../../../schema/document";
import { LayoutFeed } from "../../../schema/feed";
import { Row, Section, SelectField, TextField } from "../primitives";
import { DerivationFields } from "./DerivationFields";

export type FeedsSectionProps = {
  doc: LayoutDoc;
  onChange: (doc: LayoutDoc) => void;
};

export const FeedsSection = ({ doc, onChange }: FeedsSectionProps) => {
  const catalog = useHostCatalog();
  const feeds = docFeeds(doc);
  const firstSource = catalog.sources[0];

  if (!firstSource) return null;

  return (
    <Section title="Data feeds">
      {feeds.length === 0 && (
        <p className="text-xs text-secondary">
          Add a feed to show live values in text, like{" "}
          <code>{"{{next.notes}}"}</code>.
        </p>
      )}

      {feeds.map((feed) => (
        <FeedRow key={feed.name} doc={doc} feed={feed} onChange={onChange} />
      ))}

      <button
        type="button"
        className="text-xs border border-stroke rounded px-2 py-1 cursor-pointer transition-colors hover:border-primary hover:bg-primary/10"
        onClick={() =>
          onChange(
            addFeed(doc, {
              name: "feed",
              source: firstSource.source,
              derivation: null,
            }).doc,
          )
        }
      >
        + Add feed
      </button>
    </Section>
  );
};

const FeedRow = ({
  doc,
  feed,
  onChange,
}: {
  doc: LayoutDoc;
  feed: LayoutFeed;
  onChange: (doc: LayoutDoc) => void;
}) => {
  const catalog = useHostCatalog();
  const selected = findSourceOption(catalog.sources, feed.source);
  const fields = catalog.derivationFields?.(feed.source) ?? [];
  const bindings = catalog.dataBindings?.(feed.source) ?? [];

  return (
    <div className="flex flex-col gap-2 border border-stroke rounded p-2">
      <Row label="Name">
        <div className="flex gap-1">
          <FeedNameField
            name={feed.name}
            onCommit={(next) => onChange(renameFeed(doc, feed.name, next))}
          />
          <button
            type="button"
            title="Remove feed"
            className="text-xs border border-stroke rounded px-2 cursor-pointer transition-colors hover:border-red-500 hover:text-red-500"
            onClick={() => onChange(removeFeed(doc, feed.name))}
          >
            Remove
          </button>
        </div>
      </Row>

      <Row label="Source">
        <SelectField
          value={selected?.id ?? ""}
          options={catalog.sources.map((option) => ({
            value: option.id,
            label: option.group
              ? `${option.group} — ${option.label}`
              : option.label,
          }))}
          onChange={(id) => {
            const option = catalog.sources.find((o) => o.id === id);
            if (option)
              onChange(patchFeed(doc, feed.name, { source: option.source }));
          }}
        />
      </Row>

      {fields.length > 0 && (
        <DerivationFields
          fields={fields}
          derivation={feed.derivation}
          onChange={(derivation: Derivation | null) =>
            onChange(patchFeed(doc, feed.name, { derivation }))
          }
        />
      )}

      {bindings.length > 0 ? (
        <p className="text-xs text-secondary">
          {bindings.map((b) => `{{${feed.name}.${b.key}}}`).join(", ")}
        </p>
      ) : (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          This source publishes no values.
        </p>
      )}
    </div>
  );
};

const FeedNameField = ({
  name,
  onCommit,
}: {
  name: string;
  onCommit: (next: string) => void;
}) => {
  const [draft, setDraft] = useState(name);

  // A rejected rename (empty, or already taken) leaves the doc unchanged, so
  // the field has to fall back to the name that is actually stored.
  useEffect(() => setDraft(name), [name]);

  return (
    <div
      onBlur={() => {
        onCommit(draft);
        // Undoes an invalid draft; an accepted rename arrives via the effect.
        setDraft(name);
      }}
      className="flex-1"
    >
      <TextField value={draft} onChange={setDraft} />
    </div>
  );
};
