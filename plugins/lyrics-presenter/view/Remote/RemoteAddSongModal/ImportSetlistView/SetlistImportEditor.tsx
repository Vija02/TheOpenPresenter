import { Input } from "@repo/ui";
import { Dispatch, SetStateAction } from "react";

import { Song } from "../../../../src";
import { LyricsEditor } from "../ImportSongView/LyricsEditor";
import { SongPreview } from "../ImportSongView/SongPreview";
import { SectionHeading } from "../SectionHeading";

type SetlistImportEditorProps = {
  previewSong: Song;
  title: string;
  onTitleChange: (title: string) => void;
  content: string;
  originalContent: string;
  setContent: Dispatch<SetStateAction<string | null>>;
  saveToSongbook: boolean;
  onSaveToSongbookChange: (save: boolean) => void;
  isEditingLyrics: boolean;
  setIsEditingLyrics: Dispatch<SetStateAction<boolean>>;
};

export const SetlistImportEditor = ({
  previewSong,
  title,
  onTitleChange,
  content,
  originalContent,
  setContent,
  saveToSongbook,
  onSaveToSongbookChange,
  isEditingLyrics,
  setIsEditingLyrics,
}: SetlistImportEditorProps) => (
  <>
    <div className="stack-col items-stretch gap-2">
      <SectionHeading>Song name</SectionHeading>
      <Input
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder="Song name"
        className="w-full"
      />
      <SectionHeading>Import settings</SectionHeading>
      <label className="stack-row items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={saveToSongbook}
          onChange={(e) => onSaveToSongbookChange(e.target.checked)}
        />
        <span className="text-sm">Save to songbook</span>
      </label>
    </div>

    {isEditingLyrics ? (
      <LyricsEditor
        previewSong={previewSong}
        originalContent={originalContent}
        editorKey="setlist-song"
        importSongContent={content}
        setImportSongContent={setContent}
        setIsEditingLyrics={setIsEditingLyrics}
      />
    ) : (
      <SongPreview
        previewSong={previewSong}
        importSongContent={content}
        setImportSongContent={setContent}
        setIsEditingLyrics={setIsEditingLyrics}
      />
    )}
  </>
);
