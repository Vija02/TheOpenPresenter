import { ToggleGroup, ToggleGroupItem } from "@repo/ui";
import { ReactNode } from "react";

export type ToggleOption<T extends string> = {
  value: T;
  label: string;
  icon?: ReactNode;
};

/**
 * Segmented control for small closed sets
 */
export const ToggleGroupField = <T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: ToggleOption<T>[];
}) => (
  <ToggleGroup
    type="single"
    size="sm"
    value={value}
    className="justify-start"
    // Radix emits "" when you click the active item to deselect it
    onValueChange={(v) => {
      if (v) onChange(v as T);
    }}
  >
    {options.map((o) => (
      <ToggleGroupItem
        key={o.value}
        value={o.value}
        size="sm"
        aria-label={o.label}
        title={o.label}
      >
        {o.icon ?? o.label}
      </ToggleGroupItem>
    ))}
  </ToggleGroup>
);
