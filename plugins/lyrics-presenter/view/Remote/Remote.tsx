import { Box, Button, Text } from "@chakra-ui/react";
import { OverlayToggle, PluginScaffold } from "@repo/ui";
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

  const onExport = useCallback(() => {
    songs.forEach((song) => {
      const convertedData = exportToOpenSong(song);
      download(convertedData, `${song.title.replace(/ /g, "_")}.xml`, "xml");
    });
  }, [songs]);

  return (
    <PluginScaffold
      title="Lyrics"
      toolbar={
        <>
          <OverlayToggle
            toggler={({ onToggle }) => (
              <Button
                size="xs"
                bg="transparent"
                color="white"
                border="1px solid #ffffff6b"
                _hover={{ bg: "rgba(255, 255, 255, 0.13)" }}
                onClick={onToggle}
              >
                <VscAdd />
                <Text ml={1} fontWeight="normal" fontSize="xs">
                  Add
                </Text>
              </Button>
            )}
          >
            <RemoteAddSongModal />
          </OverlayToggle>
          <OverlayToggle
            toggler={({ onToggle }) => (
              <Button
                size="xs"
                bg="transparent"
                color="white"
                border="1px solid #ffffff6b"
                _hover={{ bg: "rgba(255, 255, 255, 0.13)" }}
                onClick={onToggle}
              >
                <VscPaintcan />{" "}
                <Text ml={1} fontWeight="normal" fontSize="xs">
                  Style
                </Text>
              </Button>
            )}
          >
            <StyleSettingModal />
          </OverlayToggle>
          <Button
            size="xs"
            bg="transparent"
            color="white"
            border="1px solid #ffffff6b"
            _hover={{ bg: "rgba(255, 255, 255, 0.13)" }}
            onClick={onExport}
          >
            <PiExportLight />{" "}
            <Text ml={1} fontWeight="normal" fontSize="xs">
              Export
            </Text>
          </Button>
        </>
      }
      body={
        <Box p={3} w="100%">
          {songs.map((song) => (
            <SongView key={song.id} song={song} />
          ))}
          <OverlayToggle
            toggler={({ onToggle }) => (
              <Button
                size="sm"
                colorScheme="green"
                cursor="pointer"
                onClick={onToggle}
              >
                <VscAdd />
                <Text ml={2}>Add Song</Text>
              </Button>
            )}
          >
            <RemoteAddSongModal />
          </OverlayToggle>
        </Box>
      }
    />
  );
};

export default Remote;
