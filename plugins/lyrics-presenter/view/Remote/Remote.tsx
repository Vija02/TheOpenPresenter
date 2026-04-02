import { Button, OverlayToggle, PluginScaffold } from "@repo/ui";
import { useCallback } from "react";
import { PiExportLight } from "react-icons/pi";
import { VscAdd, VscPaintcan } from "react-icons/vsc";

import { removeChords } from "../../src/processLyrics";
import { Song } from "../../src/types";
import { usePluginAPI } from "../pluginApi";
import RemoteAddSongModal from "./RemoteAddSongModal";
import SongView from "./SongView";
import StyleSettingModal from "./StyleSettingModal";

const processContent = (content: string) => {
  // We need to export the real chord, so let's just remove it for now
  const contentWithoutChords = removeChords(content.split("\n"));

  for (let i = 0; i < contentWithoutChords.length; i++) {
    const songLine = contentWithoutChords[i] ?? "";

    // Update to opensong format
    if (songLine.startsWith("[") && songLine.endsWith("]")) {
      // Remove white space in heading
      contentWithoutChords[i] = songLine.replace(/ /g, "");
    } else if (songLine === "-") {
      contentWithoutChords[i] = songLine.replace(/-/g, "||");
    }
  }

  return contentWithoutChords.join("\n");
};

const exportToOpenSong = (
  song: Song,
) => `<?xml version="1.0" encoding="UTF-8"?><song><lyrics>${processContent(song.content)}</lyrics>
${song.import?.importedData?.original_chord ? `<key>${song.import?.importedData?.original_chord}</key>` : ``}
<title>${song.title}</title>
${song.author ? `<author>${song.author}</author>` : ``}
</song>
`;

function download(data: string, filename: string, type: string) {
  const a = document.createElement("a");
  const file = new Blob([data], { type: type });

  const url = URL.createObjectURL(file);
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(function () {
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, 0);
}

const Remote = () => {
  const pluginApi = usePluginAPI();
  const songs = pluginApi.scene.useData((x) => x.pluginData.songs);
  const mutableSceneData = pluginApi.scene.useValtioData();

  const onExport = useCallback(() => {
    songs.forEach((song) => {
      const convertedData = exportToOpenSong(song);
      download(convertedData, `${song.title.replace(/ /g, "_")}.xml`, "xml");
    });
  }, [songs]);

  const swapSongs = useCallback(
    (a: number, b: number) => {
      const s = mutableSceneData.pluginData.songs;
      const temp = s[a]!;
      s[a] = s[b]!;
      s[b] = temp;
    },
    [mutableSceneData.pluginData.songs],
  );

  return (
    <PluginScaffold
      title="Lyrics"
      toolbar={
        <>
          <OverlayToggle
            toggler={({ onToggle }) => (
              <Button size="xs" variant="pill" onClick={onToggle}>
                <VscAdd />
                Add
              </Button>
            )}
          >
            <RemoteAddSongModal />
          </OverlayToggle>
          <OverlayToggle
            toggler={({ onToggle }) => (
              <Button size="xs" variant="pill" onClick={onToggle}>
                <VscPaintcan />
                Style
              </Button>
            )}
          >
            <StyleSettingModal />
          </OverlayToggle>
          <Button size="xs" variant="pill" onClick={onExport}>
            <PiExportLight /> Export
          </Button>
        </>
      }
      body={
        <div className="p-3 w-full">
          {songs.map((song, index) => (
            <SongView
              key={song.id}
              song={song}
              onMoveUp={
                index > 0 ? () => swapSongs(index, index - 1) : undefined
              }
              onMoveDown={
                index < songs.length - 1
                  ? () => swapSongs(index, index + 1)
                  : undefined
              }
            />
          ))}
          <OverlayToggle
            toggler={({ onToggle }) => (
              <Button
                size="sm"
                variant="success"
                onClick={onToggle}
                data-testid="ly-add-song"
              >
                <VscAdd />
                Add Song
              </Button>
            )}
          >
            <RemoteAddSongModal />
          </OverlayToggle>
        </div>
      }
    />
  );
};

export default Remote;
