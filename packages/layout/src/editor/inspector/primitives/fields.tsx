import { Checkbox, ColorPicker, Input, NumberInput } from "@repo/ui";
import { useState } from "react";

import { inspectorInputClass } from "./styles";

const decimalsOf = (step: number): number => {
  const s = String(step);
  const dot = s.indexOf(".");
  return dot === -1 ? 0 : s.length - dot - 1;
};

export const NumberField = ({
  value,
  onChange,
  min,
  max,
  step = 1,
  precision,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  precision?: number;
}) => (
  <NumberInput
    className="h-8 text-sm"
    value={Number.isFinite(value) ? value : 0}
    min={min}
    max={max}
    step={step}
    // Derived from step unless overridden
    precision={precision ?? decimalsOf(step)}
    clampValueOnBlur
    keepWithinRange
    // Undefined means the field is mid-edit (empty). Ignoring it keeps the
    // document valid rather than writing NaN into a rect.
    onChange={(v) => {
      if (typeof v === "number" && Number.isFinite(v)) onChange(v);
    }}
  />
);

export const CompactNumberField = ({
  value,
  onChange,
  min = -Infinity,
  max = Infinity,
  suffix,
  width = 56,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  suffix?: string;
  width?: number;
  label?: string;
}) => {
  const [draft, setDraft] = useState<string | null>(null);

  const commit = () => {
    if (draft === null) return;
    const parsed = Number(draft);
    setDraft(null);
    if (draft.trim() !== "" && Number.isFinite(parsed)) {
      onChange(Math.min(max, Math.max(min, parsed)));
    }
  };

  return (
    <div className="flex items-center gap-1" style={{ width }}>
      <input
        className="lay--field-input lay--field-input--number flex-1"
        value={draft ?? String(value)}
        inputMode="numeric"
        aria-label={label}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") {
            commit();
            e.currentTarget.blur();
          } else if (e.key === "Escape") {
            setDraft(null);
            e.currentTarget.blur();
          }
        }}
      />
      {suffix && (
        <span className="shrink-0 text-2xs text-secondary">{suffix}</span>
      )}
    </div>
  );
};

export const TextField = ({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) => (
  <Input
    className="h-8 text-sm"
    value={value}
    placeholder={placeholder}
    onChange={(e) => onChange(e.target.value)}
  />
);

export const ColorField = ({
  value,
  onChange,
  alpha = false,
}: {
  value: string;
  onChange: (v: string) => void;
  alpha?: boolean;
}) => <ColorPicker value={value} onChange={onChange} alpha={alpha} />;

export const SelectField = <T extends string | number>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: string) => void;
  options: { value: T; label: string }[];
}) => (
  <select
    className={inspectorInputClass}
    value={value}
    onChange={(e) => onChange(e.target.value)}
  >
    {options.map((o) => (
      <option key={String(o.value)} value={o.value}>
        {o.label}
      </option>
    ))}
  </select>
);

export const CheckField = ({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) => (
  <label className="flex items-center gap-2">
    <Checkbox
      checked={checked}
      // Radix reports "indeterminate"; the inspector has no tri-state.
      onCheckedChange={(v) => onChange(v === true)}
    />
    <span className="text-xs">{label}</span>
  </label>
);
