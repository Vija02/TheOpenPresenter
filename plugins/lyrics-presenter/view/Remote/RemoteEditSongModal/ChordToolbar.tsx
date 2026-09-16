import { Button } from "@repo/ui";
import { useMemo } from "react";

import {
  resolveKey,
  transposeContent,
  transposeKey,
} from "../../../src/chords/song";

export const ChordToolbar = ({
  content,
  songKey,
  onChange,
  onRemoveChords,
}: {
  content: string;
  songKey: string | null | undefined;
  onChange: (content: string, key: string | null) => void;
  onRemoveChords: () => void;
}) => {
  const key = useMemo(
    () => resolveKey({ key: songKey, content }),
    [content, songKey],
  );

  // Transposing moves the key too, or the stored one goes stale.
  const transpose = (semitones: number) =>
    onChange(
      transposeContent(content, semitones, key),
      transposeKey(key, semitones),
    );

  return (
    <div className="stack-row w-full flex-wrap justify-between gap-2 rounded-sm border border-stroke bg-surface-secondary px-2 py-1.5">
      <div className="stack-row gap-2">
        <span className="text-xs font-medium">Transpose</span>

        <div className="stack-row gap-0">
          <Button
            size="xs"
            variant="outline"
            className="rounded-r-none"
            disabled={!key}
            onClick={() => transpose(-1)}
            data-testid="ly-transpose-down"
            title="Transpose down a semitone"
          >
            &minus;
          </Button>
          <span
            className="h-6 min-w-14 border-y border-stroke bg-surface-primary px-2 text-center text-xs leading-6 font-medium"
            data-testid="ly-key"
          >
            {key ?? "No key"}
          </span>
          <Button
            size="xs"
            variant="outline"
            className="rounded-l-none"
            disabled={!key}
            onClick={() => transpose(1)}
            data-testid="ly-transpose-up"
            title="Transpose up a semitone"
          >
            +
          </Button>
        </div>
      </div>

      <div className="stack-row gap-1">
        <Button
          size="xs"
          variant="outline"
          onClick={onRemoveChords}
          data-testid="ly-remove-chords"
        >
          Remove all chords
        </Button>
      </div>
    </div>
  );
};
