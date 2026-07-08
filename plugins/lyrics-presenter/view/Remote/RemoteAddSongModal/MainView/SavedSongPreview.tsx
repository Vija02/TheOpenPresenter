import { Button, cn } from "@repo/ui";
import { useEffect, useMemo, useState } from "react";
import { VscClose } from "react-icons/vsc";

import { SavedSong } from "../../../../src";
import { removeChords } from "../../../../src/processLyrics";
import { cleanWhiteSpace } from "../../../../src/songHelpers";
import { useAddSongScene } from "../useAddSongScene";

export const SavedSongPreview = ({
  saved,
  onClose,
}: {
  saved: SavedSong;
  onClose: () => void;
}) => {
  const { close, addLinkedSavedSong } = useAddSongScene();

  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(true), []);

  // Plain lyric text
  const lyrics = useMemo(() => {
    const lines = cleanWhiteSpace(
      removeChords(saved.song.content.split(/<br>|\n/gm)),
    );
    return lines
      .filter((l) => l && l !== "-" && !(l.startsWith("[") && l.endsWith("]")))
      .join("\n");
  }, [saved.song.content]);

  const submit = () => {
    addLinkedSavedSong(saved);
    close();
  };

  return (
    <div
      className={cn(
        "grid transition-[grid-template-rows] duration-200 ease-out",
        open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
      )}
    >
      <div className="overflow-hidden">
        <div className="relative flex items-end gap-3 border-l-3 border-fill-info bg-surface-secondary px-3 py-2">
          <button
            type="button"
            onClick={onClose}
            title="Close"
            className="absolute right-1 top-1 cursor-pointer p-1 text-secondary hover:text-primary"
          >
            <VscClose />
          </button>
          <p className="max-h-40 flex-1 gap-6 overflow-hidden pr-2 text-sm text-secondary whitespace-pre-line columns-[9rem_3]">
            {lyrics || "No lyrics"}
          </p>
          <Button
            size="sm"
            variant="success"
            onClick={submit}
            className="shrink-0"
          >
            Add to list
          </Button>
        </div>
      </div>
    </div>
  );
};
