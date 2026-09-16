import { Button, FormLabel } from "@repo/ui";

import { AiFormatButton } from "./AiFormatButton";
import { SongEditInfo } from "./SongEditInfo";

export const LyricFormLabel = ({
  canReset,
  content,
  onRemoveChords,
  onReset,
  onFormatted,
}: {
  canReset: boolean;
  content: string;
  onRemoveChords: () => void;
  onReset: () => void;
  onFormatted: (content: string) => void;
}) => {
  return (
    <div className="stack-row justify-between w-full gap-1 flex-wrap">
      <FormLabel className="stack-row mb-0">
        Lyric <SongEditInfo />
      </FormLabel>
      <div className="stack-row">
        <Button size="xs" onClick={onRemoveChords}>
          Remove chords
        </Button>
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
