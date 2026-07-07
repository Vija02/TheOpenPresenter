import { Input } from "@repo/ui";
import { Dispatch, SetStateAction } from "react";

import { SectionHeading } from "../SectionHeading";

type ImportSongDetailsProps = {
  importSongTitle: string | null;
  setImportSongTitle: Dispatch<SetStateAction<string | null>>;
  saveToSongbook: boolean;
  setSaveToSongbook: Dispatch<SetStateAction<boolean>>;
};

// The top section
export const ImportSongDetails = ({
  importSongTitle,
  setImportSongTitle,
  saveToSongbook,
  setSaveToSongbook,
}: ImportSongDetailsProps) => (
  <div className="stack-col items-stretch gap-2 mb-3">
    <SectionHeading>Song name</SectionHeading>
    <Input
      value={importSongTitle ?? ""}
      onChange={(e) => setImportSongTitle(e.target.value)}
      placeholder="Song name"
      className="w-full"
    />
    <SectionHeading>Import settings</SectionHeading>
    <label className="stack-row items-center gap-2 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={saveToSongbook}
        onChange={(e) => setSaveToSongbook(e.target.checked)}
      />
      <span className="text-sm">Save to songbook</span>
    </label>
  </div>
);
