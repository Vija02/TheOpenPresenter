import { Button, LoadingInline } from "@repo/ui";
import { useEffect, useMemo, useState } from "react";
import { typeidUnboxed } from "typeid-js";

import { Song } from "../../../../src";
import { trpc } from "../../../trpc";
import { AddSongFooter } from "../AddSongFooter";
import { useAddSongScene } from "../useAddSongScene";
import { ImportSongDetails } from "./ImportSongDetails";
import { LyricsEditor } from "./LyricsEditor";
import { SongPreview } from "./SongPreview";

export const ImportSongView = ({ mwlId }: { mwlId: number }) => {
  const { close, addSong } = useAddSongScene();

  const [importSongTitle, setImportSongTitle] = useState<string | null>(null);
  const [importSongContent, setImportSongContent] = useState<string | null>(
    null,
  );
  const [isEditingLyrics, setIsEditingLyrics] = useState(false);
  const [saveToSongbook, setSaveToSongbook] = useState(true);

  const mwlSongQuery = trpc.lyricsPresenter.myworshiplist.getSong.useQuery({
    id: mwlId,
  });

  // Seed the editable fields once the lyrics arrive
  useEffect(() => {
    if (mwlSongQuery.data) {
      setImportSongTitle(mwlSongQuery.data.title);
      setImportSongContent(mwlSongQuery.data.content);
    }
  }, [mwlSongQuery.data]);

  const previewSong = useMemo<Song | null>(() => {
    if (!mwlSongQuery.data) return null;
    return {
      id: "",
      title: importSongTitle ?? mwlSongQuery.data.title,
      author: mwlSongQuery.data.author,
      content: importSongContent ?? mwlSongQuery.data.content,
      _imported: true,
      setting: { displayType: "sections" },
    };
  }, [mwlSongQuery.data, importSongTitle, importSongContent]);

  const submit = () => {
    if (!mwlSongQuery.data) return;
    const imported: Song = {
      id: typeidUnboxed(),
      title: importSongTitle ?? mwlSongQuery.data.title,
      author: mwlSongQuery.data.author,
      content: importSongContent ?? mwlSongQuery.data.content,
      _imported: true,
      import: {
        type: "myworshiplist",
        meta: { id: mwlId },
        importedData: {
          id: mwlId,
          title: mwlSongQuery.data.title,
          author: mwlSongQuery.data.author,
          year: null,
          content: mwlSongQuery.data.content,
          original_chord: "",
        },
      },
      setting: { displayType: "sections" },
    };
    addSong(imported, saveToSongbook);
    close();
  };

  return (
    <div className="stack-col items-stretch mb-4">
      {mwlSongQuery.isLoading && (
        <div className="flex justify-center py-8">
          <LoadingInline />
        </div>
      )}
      {previewSong && (
        <>
          <ImportSongDetails
            importSongTitle={importSongTitle}
            setImportSongTitle={setImportSongTitle}
            saveToSongbook={saveToSongbook}
            setSaveToSongbook={setSaveToSongbook}
          />
          {isEditingLyrics ? (
            <LyricsEditor
              previewSong={previewSong}
              originalContent={mwlSongQuery.data?.content ?? ""}
              editorKey={mwlId}
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

      <AddSongFooter>
        <Button
          variant="success"
          disabled={!mwlSongQuery.data}
          onClick={submit}
        >
          Import
        </Button>
        <Button variant="outline" onClick={close}>
          Cancel
        </Button>
      </AddSongFooter>
    </div>
  );
};
