import { Button, SlideGrid } from "@repo/ui";
import { Dispatch, SetStateAction } from "react";
import { VscEdit } from "react-icons/vsc";

import { Song } from "../../../../src";
import { getMergedSlideStyle } from "../../../../src/slideStyle";
import { usePluginAPI } from "../../../pluginApi";
import { AiFormatButton } from "../../RemoteEditSongModal/AiFormatButton";
import { SongViewSlides } from "../../SongViewSlides";
import { SectionHeading } from "../SectionHeading";

type SongPreviewProps = {
  previewSong: Song;
  importSongContent: string | null;
  setImportSongContent: Dispatch<SetStateAction<string | null>>;
  setIsEditingLyrics: Dispatch<SetStateAction<boolean>>;
};

// Main preview before edit
export const SongPreview = ({
  previewSong,
  importSongContent,
  setImportSongContent,
  setIsEditingLyrics,
}: SongPreviewProps) => {
  const pluginApi = usePluginAPI();
  const globalStyle = pluginApi.scene.useData((x) => x.pluginData.style);
  const slideStyle = getMergedSlideStyle(globalStyle, previewSong.styleOverride);

  return (
    <div className="stack-col items-stretch">
      <div className="stack-row justify-between items-center w-full gap-2 mb-2">
        <SectionHeading>Preview</SectionHeading>
        <div className="stack-row items-center gap-2">
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={() => setIsEditingLyrics(true)}
          >
            <VscEdit />
            Edit
          </Button>
          <AiFormatButton
            content={importSongContent ?? ""}
            onFormatted={setImportSongContent}
          />
        </div>
      </div>
      <SlideGrid pluginAPI={pluginApi}>
        <SongViewSlides song={previewSong} slideStyle={slideStyle} isPreview />
      </SlideGrid>
    </div>
  );
};
