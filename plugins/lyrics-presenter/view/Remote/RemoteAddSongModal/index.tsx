import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  OverlayToggleComponentProps,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  cn,
} from "@repo/ui";
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

export type RemoteAddSongModalPropTypes = Partial<OverlayToggleComponentProps>;

export enum Mode {
  NONE = "none",
  SEARCH_SONG = "search",
  CREATE_SONG = "create",
  IMPORT_PLAYLIST = "playlist",
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
  const handleTabsChange = useCallback((index: string) => {
    setSelectedMode(index as Mode);
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
    <Dialog
      open={isOpen ?? false}
      onOpenChange={onToggle ?? (() => {})}
      {...props}
    >
      <DialogContent
        size={selectedMode === Mode.NONE ? "sm" : "3xl"}
        className={cn("gap-0", selectedMode === Mode.NONE && "pb-5")}
      >
        <DialogHeader className="pb-4">
          <DialogTitle>Add song(s)</DialogTitle>
        </DialogHeader>
        <DialogBody
          className={cn(
            "overflow-x-hidden pt-0",
            selectedMode === Mode.CREATE_SONG && "pb-4",
          )}
        >
          {selectedMode === Mode.NONE && (
            <LandingAddSong
              onSearch={(val) => {
                setSelectedMode(Mode.SEARCH_SONG);
                setInitialSongSearch(val);
              }}
              onSetMode={setSelectedMode}
            />
          )}
          {selectedMode !== Mode.NONE && (
            <Tabs
              value={selectedMode}
              onValueChange={handleTabsChange}
              className="relative"
            >
              <TabsList>
                <TabsTrigger value="search">Search Song</TabsTrigger>
                <TabsTrigger value="create">Create Song</TabsTrigger>
                <TabsTrigger value="playlist">Import Playlist</TabsTrigger>
              </TabsList>

              <TabsContent value={Mode.SEARCH_SONG}>
                <SearchSong
                  key={initialSongSearch}
                  initialValue={initialSongSearch}
                  selectedSongId={selectedSongId}
                  setSelectedSongId={setSelectedSongId}
                />
              </TabsContent>
              <TabsContent value={Mode.CREATE_SONG}>
                <CreateNewSong
                  onChange={(song) => {
                    if (!isEqual(song, newSong)) {
                      setNewSong(song);
                    }
                  }}
                />
              </TabsContent>
              <TabsContent value={Mode.IMPORT_PLAYLIST}>
                <ImportPlaylist
                  setSelectedPlaylistSongIds={setSelectedPlaylistSongIds}
                />
              </TabsContent>
            </Tabs>
          )}
        </DialogBody>

        {selectedMode !== Mode.NONE && (
          <DialogFooter className="pl-lyrics--preview-shadow pt-0 px-0 pb-3">
            <div className="flex flex-col w-full">
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
              <div className="stack-row pt-3 px-3 md:px-6 self-end">
                <Button
                  variant="success"
                  disabled={!canSubmit}
                  onClick={() => {
                    addSong();
                  }}
                >
                  Add to list
                </Button>
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
              </div>
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default RemoteAddSongModal;
