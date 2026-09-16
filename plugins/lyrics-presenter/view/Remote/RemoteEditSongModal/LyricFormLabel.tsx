import { Button, FormLabel } from "@repo/ui";

import { AiFormatButton } from "./AiFormatButton";
import { SongEditInfo } from "./SongEditInfo";

export const LyricFormLabel = ({
  canReset,
  content,
  hasChords,
  showChords,
  onToggleShowChords,
  onReset,
  onFormatted,
}: {
  canReset: boolean;
  content: string;
  hasChords: boolean;
  showChords: boolean;
  onToggleShowChords: () => void;
  onReset: () => void;
  onFormatted: (content: string) => void;
}) => {
  return (
    <div className="stack-row justify-between w-full gap-1 flex-wrap">
      <FormLabel className="stack-row mb-0">
        Lyric <SongEditInfo />
      </FormLabel>
      <div className="stack-row">
        {hasChords && (
          <Button
            size="xs"
            onClick={onToggleShowChords}
            data-testid="ly-toggle-chords"
          >
            {showChords ? "Hide chords" : "Show chords"}
          </Button>
        )}
        <AiFormatButton content={content} onFormatted={onFormatted} />
        {canReset && (
          <Button size="xs" onClick={onReset}>
            Reset
          </Button>
        )}
      </div>
    </div>
  );
};
