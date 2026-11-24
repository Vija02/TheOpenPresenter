import {
  FontOption,
  findFontOption,
  getAddFontHandler,
  getFontOptions,
  subscribeToFontOptions,
} from "@repo/layout";
import { useEffect, useState, useSyncExternalStore } from "react";

import { ensureFontsLoaded } from "../../../react/text/fontStatus";
import { inspectorInputClass } from "./styles";

/** Sentinel for a stack that is not in the registry. Never written to a doc. */
const CUSTOM_FONT = "__custom__";
const ADD_FONT = "__add__";

const GROUPS: { source: FontOption["source"]; label: string }[] = [
  { source: "bundled", label: "Built in" },
  { source: "organization", label: "Your fonts" },
  { source: "system", label: "System" },
];

export const FontField = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) => {
  const options = useSyncExternalStore(subscribeToFontOptions, getFontOptions);
  const addFont = useSyncExternalStore(
    subscribeToFontOptions,
    getAddFontHandler,
  );
  const [adding, setAdding] = useState(false);

  useEffect(() => ensureFontsLoaded([]), []);

  const known = findFontOption(value);

  return (
    <select
      className={inspectorInputClass}
      style={{ fontFamily: known?.stack }}
      value={adding ? ADD_FONT : (known?.stack ?? CUSTOM_FONT)}
      disabled={adding}
      onChange={(e) => {
        const next = e.target.value;
        if (next === CUSTOM_FONT) return;
        if (next === ADD_FONT) {
          if (!addFont) return;
          setAdding(true);
          void addFont()
            .then((stack) => {
              if (stack) onChange(stack);
            })
            .finally(() => setAdding(false));
          return;
        }
        onChange(next);
      }}
    >
      {!known && (
        <option value={CUSTOM_FONT} disabled>
          Custom ({value || "unset"})
        </option>
      )}
      {GROUPS.map(({ source, label }) => {
        const group = options.filter((f) => f.source === source);
        if (group.length === 0) return null;
        return (
          <optgroup key={source} label={label}>
            {group.map((f) => (
              // Preview each face in itself
              <option
                key={f.id}
                value={f.stack}
                style={{ fontFamily: f.stack }}
              >
                {f.label}
              </option>
            ))}
          </optgroup>
        );
      })}
      {addFont && (
        <option value={ADD_FONT}>
          {adding ? "Adding font…" : "Add a font…"}
        </option>
      )}
    </select>
  );
};
