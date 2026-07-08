import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  LoadingInline,
  PopConfirm,
  SlideGrid,
  useOverlayToggle,
} from "@repo/ui";
import { useMemo, useState } from "react";
import { VscAdd, VscArrowLeft, VscCheck, VscTrash } from "react-icons/vsc";

import { SavedSong } from "../../../src";
import { getMergedSlideStyle } from "../../../src/slideStyle";
import { usePluginAPI } from "../../pluginApi";
import { trpc } from "../../trpc";
import { useAddSongScene } from "../RemoteAddSongModal/useAddSongScene";
import { SongViewSlides } from "../SongViewSlides";

/**
 * Browse the organization's songbook
 */
const SongbookModal = () => {
  const { isOpen, onToggle } = useOverlayToggle();
  const pluginApi = usePluginAPI();
  const pluginId = pluginApi.pluginContext.pluginId;
  const globalStyle = pluginApi.scene.useData((x) => x.pluginData.style);
  const { addLinkedSavedSong } = useAddSongScene();

  // Ids added to the setlist during this session, for a bit of inline feedback.
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  // The song currently open in the preview screen (null => showing the list).
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const listQuery = trpc.lyricsPresenter.savedSongs.list.useQuery({ pluginId });
  const removeMutation = trpc.lyricsPresenter.savedSongs.remove.useMutation({
    onSuccess: () => {
      void listQuery.refetch();
    },
    onError: () => pluginApi.remote.toast.error("Failed to delete song"),
  });

  const songs = listQuery.data ?? [];

  const filteredSongs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return songs;
    return songs.filter(
      (s) =>
        (s.title || "").toLowerCase().includes(q) ||
        (s.author || "").toLowerCase().includes(q),
    );
  }, [songs, search]);

  const previewSong = useMemo(
    () => songs.find((s) => s.id === previewId) ?? null,
    [songs, previewId],
  );

  const previewSlideStyle = useMemo(
    () => getMergedSlideStyle(globalStyle, previewSong?.song.styleOverride),
    [globalStyle, previewSong],
  );

  const handleAdd = (saved: SavedSong) => {
    addLinkedSavedSong(saved);
    setAddedIds((prev) => new Set(prev).add(saved.id));
  };

  return (
    <Dialog open={isOpen ?? false} onOpenChange={onToggle ?? (() => {})}>
      <DialogContent size="2xl" hideCloseButton={!!previewSong}>
        {previewSong ? (
          <>
            <DialogHeader className="px-3 md:px-6">
              <div className="stack-row items-center gap-2 min-w-0">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setPreviewId(null)}
                  data-testid="ly-songbook-back"
                  title="Back"
                >
                  <VscArrowLeft />
                </Button>
                <div className="min-w-0 flex-1">
                  <DialogTitle className="truncate">
                    {previewSong.title || "Untitled"}
                  </DialogTitle>
                  {previewSong.author && (
                    <p className="text-xs text-secondary truncate">
                      {previewSong.author}
                    </p>
                  )}
                </div>
                <Button
                  className="shrink-0"
                  size="sm"
                  variant="success"
                  onClick={() => {
                    handleAdd(previewSong);
                    setPreviewId(null);
                  }}
                >
                  <VscAdd />
                  Add to setlist
                </Button>
              </div>
            </DialogHeader>
            <DialogBody className="px-3 md:px-6 pb-4">
              <div className="overflow-y-auto">
                <SlideGrid pluginAPI={pluginApi}>
                  <SongViewSlides
                    song={previewSong.song}
                    slideStyle={previewSlideStyle}
                    videoBackgrounds={previewSong.videoBackgrounds}
                    isPreview
                  />
                </SlideGrid>
              </div>
            </DialogBody>
          </>
        ) : (
          <>
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
                  Your songbook is empty. Songs you save while adding to a
                  setlist show up here.
                </p>
              ) : (
                <>
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search songs..."
                    className="mb-3"
                    data-testid="ly-songbook-search"
                  />
                  {filteredSongs.length === 0 ? (
                    <p className="text-secondary text-sm py-8 text-center">
                      No songs match &quot;{search}&quot;.
                    </p>
                  ) : (
                    <div className="stack-col items-stretch gap-0 overflow-y-auto">
                      {filteredSongs.map((saved) => (
                        <div
                          key={saved.id}
                          data-testid="ly-songbook-row"
                          onClick={() => setPreviewId(saved.id)}
                          className="stack-row items-center justify-between gap-2 py-2 px-2 border-b border-stroke last:border-b-0 cursor-pointer rounded-sm hover:bg-surface-secondary"
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
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAdd(saved);
                              }}
                            >
                              <VscAdd />
                              Add
                            </Button>
                            <PopConfirm
                              title="Delete this song from your songbook?"
                              onConfirm={() =>
                                removeMutation.mutate({
                                  pluginId,
                                  id: saved.id,
                                })
                              }
                              okText="Yes"
                              cancelText="No"
                              key="remove"
                            >
                              <Button
                                size="sm"
                                variant="ghost"
                                title="Delete"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <VscTrash />
                              </Button>
                            </PopConfirm>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </DialogBody>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SongbookModal;
