import { Button, SlideGrid } from "@repo/ui";
import { Dispatch, SetStateAction } from "react";

import { Song } from "../../../../src";
import { removeChords } from "../../../../src/processLyrics";
import { getMergedSlideStyle } from "../../../../src/slideStyle";
import { usePluginAPI } from "../../../pluginApi";
import { AiFormatButton } from "../../RemoteEditSongModal/AiFormatButton";
import SongEditEditor from "../../RemoteEditSongModal/SongEditEditor";
import { SongViewSlides } from "../../SongViewSlides";
import { SectionHeading } from "../SectionHeading";

type LyricsEditorProps = {
  previewSong: Song;
  originalContent: string;
  editorKey: string | number;
  importSongContent: string | null;
  setImportSongContent: Dispatch<SetStateAction<string | null>>;
  setIsEditingLyrics: Dispatch<SetStateAction<boolean>>;
};

export const LyricsEditor = ({
  previewSong,
  originalContent,
  editorKey,
  importSongContent,
  setImportSongContent,
  setIsEditingLyrics,
}: LyricsEditorProps) => {
  const pluginApi = usePluginAPI();
  const globalStyle = pluginApi.scene.useData((x) => x.pluginData.style);
  const slideStyle = getMergedSlideStyle(globalStyle, previewSong.styleOverride);

  return (
    <div className="flex flex-col md:flex-row gap-3">
      <div className="flex-1 min-w-0 stack-col items-stretch gap-2">
        <div className="stack-row justify-between items-center w-full gap-1 flex-wrap">
          <SectionHeading>Lyrics</SectionHeading>
          <div className="stack-row gap-1">
            <Button
              size="xs"
              onClick={() =>
                setImportSongContent(
                  removeChords((importSongContent ?? "").split("\n")).join(
                    "\n",
                  ),
                )
              }
            >
              Remove chords
            </Button>
            <AiFormatButton
              content={importSongContent ?? ""}
              onFormatted={setImportSongContent}
            />
            {(importSongContent ?? "") !== originalContent && (
              <Button
                size="xs"
                onClick={() => setImportSongContent(originalContent)}
              >
                Reset
              </Button>
            )}
          </div>
        </div>
        <SongEditEditor
          key={editorKey}
          initialContent={(importSongContent ?? "")
            .split("\n")
            .map((x) => `<p>${x}</p>`)
            .join("")}
          onChange={(val) => setImportSongContent(val)}
        />
      </div>
      <div className="md:basis-[260px] shrink-0">
        <div className="stack-row justify-between items-center w-full gap-2 mb-2">
          <SectionHeading>Preview</SectionHeading>
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={() => setIsEditingLyrics(false)}
          >
            Done
          </Button>
        </div>
        <SlideGrid pluginAPI={pluginApi} forceWidth={200}>
          <SongViewSlides
            song={previewSong}
            slideStyle={slideStyle}
            isPreview
          />
        </SlideGrid>
      </div>
    </div>
  );
};
