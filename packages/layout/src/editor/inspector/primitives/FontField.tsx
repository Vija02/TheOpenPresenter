import { FONT_OPTIONS, findFontOption } from "../../../fonts/registry";
import { inspectorInputClass } from "./styles";

/** Sentinel for a stack that is not in the registry. Never written to a doc. */
const CUSTOM_FONT = "__custom__";

export const FontField = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) => {
  const known = findFontOption(value);

  return (
    <select
      className={inspectorInputClass}
      style={{ fontFamily: known?.stack }}
      value={known?.stack ?? CUSTOM_FONT}
      onChange={(e) => {
        if (e.target.value === CUSTOM_FONT) return;
        onChange(e.target.value);
      }}
    >
      {!known && (
        <option value={CUSTOM_FONT} disabled>
          Custom ({value || "unset"})
        </option>
      )}
      {FONT_OPTIONS.map((f) => (
        // Preview each face in itself
        <option key={f.id} value={f.stack} style={{ fontFamily: f.stack }}>
          {f.label}
        </option>
      ))}
    </select>
  );
};
