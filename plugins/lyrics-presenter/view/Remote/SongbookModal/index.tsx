import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  LoadingInline,
  PopConfirm,
  useOverlayToggle,
} from "@repo/ui";
import { useState } from "react";
import { VscAdd, VscCheck, VscTrash } from "react-icons/vsc";

import { SavedSong } from "../../../src";
import { usePluginAPI } from "../../pluginApi";
import { trpc } from "../../trpc";
import { useAddSongScene } from "../RemoteAddSongModal/useAddSongScene";

/**
 * Browse the organization's songbook: add a saved song to the current setlist
 * (as a linked song) or delete it from the library.
 */
const SongbookModal = () => {
  const { isOpen, onToggle } = useOverlayToggle();
  const pluginApi = usePluginAPI();
  const pluginId = pluginApi.pluginContext.pluginId;
  const { addLinkedSavedSong } = useAddSongScene();

  // Ids added to the setlist during this session, for a bit of inline feedback.
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  const listQuery = trpc.lyricsPresenter.savedSongs.list.useQuery({ pluginId });
  const removeMutation = trpc.lyricsPresenter.savedSongs.remove.useMutation({
    onSuccess: () => {
      void listQuery.refetch();
    },
    onError: () => pluginApi.remote.toast.error("Failed to delete song"),
  });

  const songs = listQuery.data ?? [];

  const handleAdd = (saved: SavedSong) => {
    addLinkedSavedSong(saved);
    setAddedIds((prev) => new Set(prev).add(saved.id));
  };

  return (
    <Dialog open={isOpen ?? false} onOpenChange={onToggle ?? (() => {})}>
      <DialogContent size="2xl">
        <DialogHeader className="px-3 md:px-6">
          <DialogTitle>Songbook</DialogTitle>
        </DialogHeader>
        <DialogBody className="px-3 md:px-6 pb-4">
          {listQuery.isLoading ? (
            <div className="flex justify-center py-8">
              <LoadingInline />
            </div>
          ) : songs.length === 0 ? (
            <p className="text-secondary text-sm py-8 text-center">
              Your songbook is empty. Songs you save while adding to a setlist
              show up here.
            </p>
          ) : (
            <div className="stack-col items-stretch gap-0 max-h-[60vh] overflow-y-auto">
              {songs.map((saved) => (
                <div
                  key={saved.id}
                  data-testid="ly-songbook-row"
                  className="stack-row items-center justify-between gap-2 py-2 px-1 border-b border-stroke last:border-b-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {saved.title || "Untitled"}
                    </p>
                    {saved.author && (
                      <p className="text-xs text-secondary truncate">
                        {saved.author}
                      </p>
                    )}
                  </div>
                  <div className="stack-row items-center gap-1 shrink-0">
                    {addedIds.has(saved.id) && (
                      <span className="stack-row items-center gap-1 text-xs text-primary">
                        <VscCheck />
                        Added
                      </span>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      title="Add to current setlist"
                      onClick={() => handleAdd(saved)}
                    >
                      <VscAdd />
                      Add
                    </Button>
                    <PopConfirm
                      title="Delete this song from your songbook?"
                      onConfirm={() =>
                        removeMutation.mutate({ pluginId, id: saved.id })
                      }
                      okText="Yes"
                      cancelText="No"
                      key="remove"
                    >
                      <Button size="sm" variant="ghost" title="Delete">
                        <VscTrash />
                      </Button>
                    </PopConfirm>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
};

export default SongbookModal;
