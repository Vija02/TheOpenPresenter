import { LoadingInline, SlideGrid } from "@repo/ui";
import { Dispatch, SetStateAction } from "react";

import { SavedSong, Song } from "../../../../src";
import { getMergedSlideStyle } from "../../../../src/slideStyle";
import { usePluginAPI } from "../../../pluginApi";
import { SongViewSlides } from "../../SongViewSlides";
import { SectionHeading } from "../SectionHeading";
import { SetlistImportEditor } from "./SetlistImportEditor";
import { SetlistSourceSelect } from "./SetlistSourceSelect";
import { SetlistChoice, SetlistImportData } from "./types";

type SetlistSongDetailProps = {
  matches: SavedSong[];
  choice: SetlistChoice | undefined;
  onChange: (choice: SetlistChoice) => void;
  isEditingLyrics: boolean;
  setIsEditingLyrics: Dispatch<SetStateAction<boolean>>;
};

export const SetlistSongDetail = ({
  matches,
  choice,
  onChange,
  isEditingLyrics,
  setIsEditingLyrics,
}: SetlistSongDetailProps) => {
  const pluginApi = usePluginAPI();
  const globalStyle = pluginApi.scene.useData((x) => x.pluginData.style);

  const matchedSong = choice?.mode === "match" ? choice.savedSong : null;
  const saveToSongbook =
    choice?.mode === "import" ? choice.saveToSongbook : true;
  const data = choice?.mode === "import" ? choice.data : undefined;

  const setImport = (next: {
    saveToSongbook?: boolean;
    data?: SetlistImportData;
  }) =>
    onChange({
      mode: "import",
      saveToSongbook: next.saveToSongbook ?? saveToSongbook,
      data: "data" in next ? next.data : data,
    });

  const setContent: Dispatch<SetStateAction<string | null>> = (value) => {
    if (!data) return;
    const val = typeof value === "function" ? value(data.content) : value;
    setImport({ data: { ...data, content: val ?? "" } });
  };

  const previewSong: Song | null = matchedSong
    ? matchedSong.song
    : data
      ? {
          id: "",
          title: data.title,
          author: data.author,
          content: data.content,
          _imported: true,
          setting: { displayType: "sections" },
        }
      : null;

  return (
    <div className="stack-col items-stretch gap-3">
      <SetlistSourceSelect
        matches={matches}
        choice={choice}
        onChange={onChange}
      />

      {matchedSong ? (
        <div className="stack-col items-stretch gap-2">
          <SectionHeading>Preview</SectionHeading>
          <SlideGrid pluginAPI={pluginApi}>
            <SongViewSlides
              song={matchedSong.song}
              slideStyle={getMergedSlideStyle(
                globalStyle,
                matchedSong.song.styleOverride,
              )}
              videoBackgrounds={matchedSong.videoBackgrounds}
              isPreview
            />
          </SlideGrid>
        </div>
      ) : !data || !previewSong ? (
        <div className="flex justify-center py-8">
          <LoadingInline />
        </div>
      ) : (
        <SetlistImportEditor
          previewSong={previewSong}
          title={data.title}
          onTitleChange={(title) => setImport({ data: { ...data, title } })}
          content={data.content}
          originalContent={data.originalContent}
          setContent={setContent}
          saveToSongbook={saveToSongbook}
          onSaveToSongbookChange={(save) => setImport({ saveToSongbook: save })}
          isEditingLyrics={isEditingLyrics}
          setIsEditingLyrics={setIsEditingLyrics}
        />
      )}
    </div>
  );
};
