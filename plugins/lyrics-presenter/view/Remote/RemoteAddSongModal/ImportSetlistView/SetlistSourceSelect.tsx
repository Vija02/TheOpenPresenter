import { SavedSong } from "../../../../src";
import { SectionHeading } from "../SectionHeading";
import { SetlistChoice } from "./types";

const IMPORT_VALUE = "__import__";

type SetlistSourceSelectProps = {
  matches: SavedSong[];
  choice: SetlistChoice | undefined;
  onChange: (choice: SetlistChoice) => void;
};

export const SetlistSourceSelect = ({
  matches,
  choice,
  onChange,
}: SetlistSourceSelectProps) => {
  const matchedSong = choice?.mode === "match" ? choice.savedSong : null;
  const selectValue = matchedSong ? matchedSong.id : IMPORT_VALUE;

  return (
    <div className="stack-col items-stretch gap-2">
      <SectionHeading>Source</SectionHeading>
      {matches.length > 0 ? (
        <select
          className="text-sm border border-stroke rounded px-2 py-1.5 w-full max-w-sm cursor-pointer"
          value={selectValue}
          onChange={(e) => {
            const value = e.target.value;
            if (value === IMPORT_VALUE) {
              onChange({ mode: "import", saveToSongbook: true });
            } else {
              const saved = matches.find((m) => m.id === value);
              if (saved) onChange({ mode: "match", savedSong: saved });
            }
          }}
        >
          {matches.map((m) => (
            <option key={m.id} value={m.id}>
              From songbook{m.author ? ` (${m.author})` : ""}
            </option>
          ))}
          <option value={IMPORT_VALUE}>Import from MyWorshipList</option>
        </select>
      ) : (
        <p className="text-sm text-secondary">
          No songbook match. It will be imported from MyWorshipList.
        </p>
      )}
    </div>
  );
};
