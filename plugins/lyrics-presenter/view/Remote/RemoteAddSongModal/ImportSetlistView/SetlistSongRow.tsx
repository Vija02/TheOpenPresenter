import { cn } from "@repo/ui";
import { VscCheck, VscCloudDownload } from "react-icons/vsc";

import { SavedSong } from "../../../../src";
import { SetlistChoice } from "./types";

type SetlistSongRowProps = {
  title: string;
  matches: SavedSong[];
  choice: SetlistChoice | undefined;
  isActive: boolean;
  onSelect: () => void;
};

export const SetlistSongRow = ({
  title,
  matches,
  choice,
  isActive,
  onSelect,
}: SetlistSongRowProps) => {
  const isMatch = choice?.mode === "match";

  const subtitle = isMatch
    ? `From songbook: ${choice.savedSong.title || "Untitled"}`
    : matches.length > 0
      ? "Import (songbook match available)"
      : "Import from MyWorshipList";

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "stack-row items-center justify-between gap-2 text-left w-full rounded-md px-2 py-2 cursor-pointer hover:bg-surface-primary-hover",
        isActive && "bg-surface-primary-active",
      )}
    >
      <div className="min-w-0">
        <p className="text-sm truncate">{title || "Untitled"}</p>
        <p className="text-xs text-secondary truncate">{subtitle}</p>
      </div>
      <span
        className={cn(
          "stack-row items-center gap-1 shrink-0 text-xs px-2 py-0.5 rounded-full border border-stroke",
          isMatch ? "text-primary" : "text-secondary",
        )}
      >
        {isMatch ? <VscCheck /> : <VscCloudDownload />}
        {isMatch ? "Songbook" : "Import"}
      </span>
    </button>
  );
};
