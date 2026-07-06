import { LoadingInline } from "@repo/ui";
import { Dispatch, SetStateAction } from "react";

import { Song } from "../../../../src";
import { ImportSongDetails } from "./ImportSongDetails";
import { LyricsEditor } from "./LyricsEditor";
import { SongPreview } from "./SongPreview";

type ImportSongViewProps = {
  isLoading: boolean;
  previewSong: Song | null;
  originalContent: string;
  editorKey: string | number;
  importSongTitle: string | null;
  setImportSongTitle: Dispatch<SetStateAction<string | null>>;
  importSongContent: string | null;
  setImportSongContent: Dispatch<SetStateAction<string | null>>;
  isEditingLyrics: boolean;
  setIsEditingLyrics: Dispatch<SetStateAction<boolean>>;
  addToSongbook: boolean;
  setAddToSongbook: Dispatch<SetStateAction<boolean>>;
};

export const ImportSongView = ({
  isLoading,
  previewSong,
  originalContent,
  editorKey,
  importSongTitle,
  setImportSongTitle,
  importSongContent,
  setImportSongContent,
  isEditingLyrics,
  setIsEditingLyrics,
  addToSongbook,
  setAddToSongbook,
}: ImportSongViewProps) => {
  return (
    <div className="stack-col items-stretch mb-4">
      {isLoading && (
        <div className="flex justify-center py-8">
          <LoadingInline />
        </div>
      )}
      {previewSong && (
        <>
          <ImportSongDetails
            importSongTitle={importSongTitle}
            setImportSongTitle={setImportSongTitle}
            addToSongbook={addToSongbook}
            setAddToSongbook={setAddToSongbook}
          />
          {isEditingLyrics ? (
            <LyricsEditor
              previewSong={previewSong}
              originalContent={originalContent}
              editorKey={editorKey}
              importSongContent={importSongContent}
              setImportSongContent={setImportSongContent}
              setIsEditingLyrics={setIsEditingLyrics}
            />
          ) : (
            <SongPreview
              previewSong={previewSong}
              importSongContent={importSongContent}
              setImportSongContent={setImportSongContent}
              setIsEditingLyrics={setIsEditingLyrics}
            />
          )}
        </>
      )}
    </div>
  );
};
