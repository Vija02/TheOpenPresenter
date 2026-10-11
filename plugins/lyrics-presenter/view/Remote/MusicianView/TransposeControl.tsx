import { useMemo } from "react";

import { keyOptions } from "../../../src/musician/chart";

type TransposeControlProps = {
  originalKey: string | null;
  transpose: number;
  disabled: boolean;
  onChange: (semitones: number) => void;
};

const formatSemitones = (semitones: number) =>
  semitones > 0 ? `+${semitones}` : `−${-semitones}`;

export const TransposeControl = ({
  originalKey,
  transpose,
  disabled,
  onChange,
}: TransposeControlProps) => {
  const options = useMemo(() => keyOptions(originalKey), [originalKey]);

  return (
    <select
      data-testid="ly-musician-key"
      aria-label="Key"
      className="h-8 rounded-sm border border-stroke bg-surface-primary px-2 text-sm font-semibold tabular-nums disabled:opacity-50"
      disabled={disabled || options.length === 0}
      value={transpose}
      onChange={(e) => onChange(Number(e.target.value))}
    >
      {options.length === 0 && <option value={0}>–</option>}
      {options.map(({ semitones, key }) => (
        <option key={semitones} value={semitones}>
          {semitones === 0
            ? `${key} (original)`
            : `${key} (${formatSemitones(semitones)})`}
        </option>
      ))}
    </select>
  );
};
