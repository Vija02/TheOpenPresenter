import { LoadingInline, SlideGrid } from "@repo/ui";

import { SavedSong, Song } from "../../../../src";
import { getMergedSlideStyle } from "../../../../src/slideStyle";
import { usePluginAPI } from "../../../pluginApi";
import { trpc } from "../../../trpc";
import { SongViewSlides } from "../../SongViewSlides";
import { SectionHeading } from "../SectionHeading";
import { SetlistChoice } from "./types";

const IMPORT_VALUE = "__import__";

type SetlistSongDetailProps = {
  mwlId: number;
  title: string;
  matches: SavedSong[];
  choice: SetlistChoice | undefined;
  onChange: (choice: SetlistChoice) => void;
};

export const SetlistSongDetail = ({
  mwlId,
  title,
  matches,
  choice,
  onChange,
}: SetlistSongDetailProps) => {
  const pluginApi = usePluginAPI();
  const globalStyle = pluginApi.scene.useData((x) => x.pluginData.style);

  const isImport = !choice || choice.mode === "import";
  const matchedSong = choice?.mode === "match" ? choice.savedSong : null;
  const selectValue = matchedSong ? matchedSong.id : IMPORT_VALUE;

  const mwlSongQuery = trpc.lyricsPresenter.getSong.useQuery(
    { id: mwlId },
    { enabled: isImport },
  );

  const importPreviewSong: Song | null = mwlSongQuery.data
    ? {
        id: "",
        title: mwlSongQuery.data.title,
        author: mwlSongQuery.data.author,
        content: mwlSongQuery.data.content,
        _imported: true,
        setting: { displayType: "sections" },
      }
    : null;

  const previewSong = matchedSong ? matchedSong.song : importPreviewSong;
  const previewSlideStyle = getMergedSlideStyle(
    globalStyle,
    previewSong?.styleOverride,
  );

  return (
    <div className="stack-col items-stretch gap-3">
      <div className="stack-col items-stretch gap-1">
        <SectionHeading>Song</SectionHeading>
        <p className="font-medium">{title || "Untitled"}</p>
      </div>

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
            <option value={IMPORT_VALUE}>
              Import fresh from MyWorshipList
            </option>
          </select>
        ) : (
          <p className="text-sm text-secondary">
            No songbook match. It will be imported from MyWorshipList.
          </p>
        )}
      </div>

      {isImport && (
        <div className="stack-col items-stretch gap-2">
          <SectionHeading>Import settings</SectionHeading>
          <label className="stack-row items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={choice?.mode === "import" ? choice.saveToSongbook : true}
              onChange={(e) =>
                onChange({ mode: "import", saveToSongbook: e.target.checked })
              }
            />
            <span className="text-sm">Save to songbook</span>
          </label>
        </div>
      )}

      <div className="stack-col items-stretch gap-2">
        <SectionHeading>Preview</SectionHeading>
        {matchedSong ? (
          <SlideGrid pluginAPI={pluginApi}>
            <SongViewSlides
              song={matchedSong.song}
              slideStyle={previewSlideStyle}
              isPreview
            />
          </SlideGrid>
        ) : mwlSongQuery.isLoading ? (
          <div className="flex justify-center py-8">
            <LoadingInline />
          </div>
        ) : importPreviewSong ? (
          <SlideGrid pluginAPI={pluginApi}>
            <SongViewSlides
              song={importPreviewSong}
              slideStyle={previewSlideStyle}
              isPreview
            />
          </SlideGrid>
        ) : (
          <p className="text-sm text-secondary">Preview unavailable.</p>
        )}
      </div>
    </div>
  );
};
