import { Checkbox, ColorPicker, Input, NumberInput } from "@repo/ui";

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
