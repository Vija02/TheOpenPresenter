import {
  Button,
  Flex,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalProps,
  Stack,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
} from "@chakra-ui/react";
import { OverlayToggleComponentProps } from "@repo/ui";
import { isEqual } from "lodash-es";
import { useCallback, useMemo, useState } from "react";
import { typeidUnboxed } from "typeid-js";

import { Song } from "../../../src";
import { usePluginAPI } from "../../pluginApi";
import { MobilePreview } from "../RemoteEditSongModal/MobilePreview";
import { SongViewSlides } from "../SongViewSlides";
import { CreateNewSong } from "./CreateNewSong";
import { ImportPlaylist } from "./ImportPlaylist";
import { LandingAddSong } from "./LandingAddSong";
import { SearchSong } from "./SearchSong";

export type RemoteAddSongModalPropTypes = Omit<
  ModalProps,
  "isOpen" | "onClose" | "children"
> &
  Partial<OverlayToggleComponentProps> & {};

export enum Mode {
  NONE = -1,
  SEARCH_SONG = 0,
  CREATE_SONG = 1,
  IMPORT_PLAYLIST = 2,
}

const RemoteAddSongModal = ({
  isOpen,
  onToggle,
  resetData,
  ...props
}: RemoteAddSongModalPropTypes) => {
  const pluginApi = usePluginAPI();
  const pluginInfo = pluginApi.scene.useValtioData();
  const slideStyle = pluginApi.scene.useData((x) => x.pluginData.style) ?? {};

  const [newSong, setNewSong] = useState<Song | null>(null);
  const [selectedSongId, setSelectedSongId] = useState<number | null>(null);
  const [selectedPlaylistSongIds, setSelectedPlaylistSongIds] = useState<
    number[] | null
  >(null);

  const [initialSongSearch, setInitialSongSearch] = useState<string | null>(
    null,
  );

  const [selectedMode, setSelectedMode] = useState(Mode.NONE);
  const handleTabsChange = useCallback((index: number) => {
    setSelectedMode(index);
  }, []);

  const canSubmit = useMemo(() => {
    if (selectedMode === Mode.CREATE_SONG) {
      return newSong !== null;
    } else if (selectedMode === Mode.SEARCH_SONG) {
      return selectedSongId !== null;
    } else if (selectedMode === Mode.IMPORT_PLAYLIST) {
      return selectedPlaylistSongIds !== null;
    }

    return false;
  }, [newSong, selectedMode, selectedPlaylistSongIds, selectedSongId]);

  const addSong = useCallback(() => {
    if (selectedMode === Mode.CREATE_SONG && newSong) {
      pluginInfo.pluginData.songs.push({
        ...newSong,
        id: typeidUnboxed(),
      });
    } else if (selectedMode === Mode.SEARCH_SONG && selectedSongId !== null) {
      pluginInfo.pluginData.songs.push({
        id: typeidUnboxed(),
        title: "",
        content: "",
        _imported: false,
        import: {
          type: "myworshiplist",
          meta: { id: selectedSongId },
        },
        setting: { displayType: "sections" },
      });
    } else if (
      selectedMode === Mode.IMPORT_PLAYLIST &&
      !!selectedPlaylistSongIds
    ) {
      selectedPlaylistSongIds.forEach((x: any) => {
        pluginInfo.pluginData.songs.push({
          id: typeidUnboxed(),
          title: "",
          content: "",
          _imported: false,
          import: {
            type: "myworshiplist",
            meta: { id: x },
          },
          setting: { displayType: "sections" },
        });
      });
    } else {
      pluginApi.remote.toast.error("Failed to add song");
      return;
    }

    onToggle?.();
    resetData?.();
  }, [
    selectedMode,
    newSong,
    selectedSongId,
    selectedPlaylistSongIds,
    onToggle,
    resetData,
    pluginInfo.pluginData.songs,
    pluginApi.remote.toast,
  ]);

  const onClose = useCallback(() => {
    onToggle?.();
    resetData?.();
  }, [onToggle, resetData]);

  return (
    <Modal
      size={selectedMode === -1 ? "sm" : { base: "full", md: "5xl" }}
      isOpen={isOpen ?? false}
      onClose={onClose}
      scrollBehavior="inside"
      {...props}
    >
      <ModalOverlay />
      <ModalContent
        maxW={selectedMode === -1 ? "sm" : "900"}
        pb={selectedMode === -1 ? 5 : 0}
      >
        <ModalHeader>Add song(s)</ModalHeader>
        <ModalCloseButton />
        <ModalBody overflowX="hidden" pt={0}>
          {selectedMode === -1 && (
            <LandingAddSong
              onSearch={(val) => {
                setSelectedMode(Mode.SEARCH_SONG);
                setInitialSongSearch(val);
              }}
              onSetMode={setSelectedMode}
            />
          )}
          {selectedMode > -1 && (
            <Tabs
              index={selectedMode}
              onChange={handleTabsChange}
              position="relative"
            >
              <TabList>
                <Tab fontSize="sm">Search Song</Tab>
                <Tab fontSize="sm">Create Song</Tab>
                <Tab fontSize="sm">Import Playlist</Tab>
              </TabList>

              <TabPanels>
                <TabPanel px={0}>
                  <SearchSong
                    key={initialSongSearch}
                    initialValue={initialSongSearch}
                    selectedSongId={selectedSongId}
                    setSelectedSongId={setSelectedSongId}
                  />
                </TabPanel>
                <TabPanel px={0}>
                  <CreateNewSong
                    onChange={(song) => {
                      if (!isEqual(song, newSong)) {
                        setNewSong(song);
                      }
                    }}
                  />
                </TabPanel>
                <TabPanel px={0}>
                  <ImportPlaylist
                    setSelectedPlaylistSongIds={setSelectedPlaylistSongIds}
                  />
                </TabPanel>
              </TabPanels>
            </Tabs>
          )}
        </ModalBody>

        {selectedMode !== -1 && (
          <ModalFooter
            pt={0}
            px={0}
            boxShadow={{
              base: "rgba(0, 0, 0, 0.8) 0px 5px 10px 0px",
              md: "none",
            }}
          >
            <Flex flexDir="column" width="100%">
              {selectedMode === Mode.CREATE_SONG && (
                <MobilePreview
                  preview={
                    newSong ? (
                      <SongViewSlides
                        song={newSong}
                        slideStyle={slideStyle}
                        isPreview
                      />
                    ) : null
                  }
                />
              )}
              <Stack
                px={{ base: 3, md: 6 }}
                pt={3}
                direction="row"
                alignSelf="flex-end"
              >
                <Button
                  colorScheme="green"
                  mr={3}
                  isDisabled={!canSubmit}
                  onClick={() => {
                    addSong();
                  }}
                >
                  Add to list
                </Button>
                <Button variant="ghost" onClick={onClose}>
                  Cancel
                </Button>
              </Stack>
            </Flex>
          </ModalFooter>
        )}
      </ModalContent>
    </Modal>
  );
};

export default RemoteAddSongModal;
