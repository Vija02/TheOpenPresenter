import { Button, FormLabel, Popover, PopoverTrigger } from "@repo/ui";
import { FaCircleInfo } from "react-icons/fa6";

import { SongEditInfo } from "./SongEditInfo";

export const LyricFormLabel = ({
  canReset,
  onRemoveChords,
  onReset,
}: {
  canReset: boolean;
  onRemoveChords: () => void;
  onReset: () => void;
}) => {
  return (
    <div className="stack-row justify-between w-full gap-1 flex-wrap">
      <FormLabel className="stack-row mb-0">
        Lyric{" "}
        <Popover>
          <PopoverTrigger asChild>
            <Button size="xs" variant="outline" className="font-light">
              <FaCircleInfo className="text-gray-700" />
              How does this work?
            </Button>
          </PopoverTrigger>
          <SongEditInfo />
        </Popover>
      </FormLabel>
      <div className="stack-row">
        <Button size="xs" onClick={onRemoveChords}>
          Remove chords
        </Button>
        {canReset && (
          <Button size="xs" onClick={onReset}>
            Reset
          </Button>
        )}
      </div>
    </div>
  );
};
