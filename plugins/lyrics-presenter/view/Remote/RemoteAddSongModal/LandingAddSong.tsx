import { Button, Input } from "@repo/ui";
import { useEffect, useRef } from "react";
import { AiOutlineImport } from "react-icons/ai";
import { FaPlus } from "react-icons/fa";

import { Mode } from ".";

export const LandingAddSong = ({
  onSetMode,
  onSearch,
}: {
  onSetMode: (mode: Mode) => void;
  onSearch: (text: string) => void;
}) => {
  const focusElement = useRef<HTMLInputElement>(null);
  useEffect(() => {
    void (focusElement.current && focusElement.current!.focus());
  }, [focusElement]);

  return (
    <div className="stack-col items-stretch">
      <div className="stack-col">
        <p className="font-bold">Search existing songs</p>
        <Input
          ref={focusElement}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Song title..."
        />
      </div>

      <p className="text-secondary text-center">or</p>

      <Button
        size="sm"
        variant="success"
        onClick={() => onSetMode(Mode.CREATE_SONG)}
      >
        <FaPlus />
        Create a new song
      </Button>

      <p className="text-secondary text-center">or</p>

      <Button
        size="sm"
        variant="outline"
        onClick={() => onSetMode(Mode.IMPORT_PLAYLIST)}
      >
        <AiOutlineImport />
        Import from existing playlist
      </Button>
    </div>
  );
};
