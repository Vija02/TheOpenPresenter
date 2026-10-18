import {
  Button,
  Popover,
  PopoverContent,
  PopoverMenuItem,
  PopoverTrigger,
  cn,
} from "@repo/ui";
import { useState } from "react";
import {
  VscClearAll,
  VscCopy,
  VscDiscard,
  VscEdit,
  VscEllipsis,
} from "react-icons/vsc";

import { Track } from "../../src/types";
import { SavedPlaylists, tracksSummary } from "./useSavedPlaylists";

type Editing = { mode: "name" | "rename" | "new"; value: string };

export const SavedPlaylistBar = ({
  saved,
  tracks,
}: {
  saved: SavedPlaylists;
  tracks: Track[];
}) => {
  const [editing, setEditing] = useState<Editing | null>(null);
  const { linked, hasUnsavedChanges, isSaving } = saved;

  const startEditing = () =>
    setEditing(
      linked
        ? { mode: "rename", value: linked.name }
        : { mode: "name", value: "" },
    );

  const commit = async () => {
    // Enter still submits while the button is disabled
    if (!editing || isSaving) return;
    const name = editing.value.trim();
    if (!name) {
      setEditing(null);
      return;
    }
    if (editing.mode === "rename" && linked) {
      if (name !== linked.name) await saved.rename(linked.id, name);
    } else {
      await saved.saveAs(name);
    }
    setEditing(null);
  };

  const isNaming = !!editing && editing.mode !== "rename";
  // Nothing to do while it matches what's saved
  const primaryAction = isNaming ? (
    <>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => setEditing(null)}
      >
        Cancel
      </Button>
      <Button
        type="submit"
        size="sm"
        variant="success"
        disabled={!editing.value.trim() || isSaving}
      >
        Save
      </Button>
    </>
  ) : !linked ? (
    <Button type="button" size="sm" variant="success" onClick={startEditing}>
      Save
    </Button>
  ) : hasUnsavedChanges ? (
    <Button
      type="button"
      size="sm"
      variant="success"
      disabled={isSaving}
      onClick={saved.saveChanges}
    >
      Save changes
    </Button>
  ) : null;

  return (
    <form
      data-testid="saved-playlist-bar"
      className="flex flex-wrap items-center gap-x-3 gap-y-2 pt-2 pb-3 border-b border-stroke"
      onSubmit={(e) => {
        e.preventDefault();
        commit();
      }}
    >
      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            autoFocus
            aria-label="Playlist name"
            placeholder="Name this playlist..."
            className="w-full -mx-1 px-1 rounded-sm text-lg font-semibold bg-transparent outline-none ring-1 ring-stroke focus:ring-ring"
            value={editing.value}
            onChange={(e) => setEditing({ ...editing, value: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Escape") setEditing(null);
            }}
            // A rename is kept, but saving needs the button
            onBlur={(e) => {
              if (e.relatedTarget?.closest("form") === e.currentTarget.form) {
                return;
              }
              if (editing.mode === "rename") commit();
              else setEditing(null);
            }}
          />
        ) : (
          <button
            type="button"
            className="group stack-row gap-2 max-w-full text-lg font-semibold text-left cursor-pointer"
            title={linked ? "Rename" : "Name this playlist"}
            onClick={startEditing}
          >
            <span className={cn("truncate", !linked && "text-secondary")}>
              {linked?.name ?? "Name this playlist..."}
            </span>
            <VscEdit className="size-4 text-secondary opacity-60 group-hover:opacity-100" />
          </button>
        )}
        <p className="stack-row gap-1.5 text-xs text-secondary">
          <span className="truncate">{tracksSummary(tracks)}</span>
          {linked && (
            <>
              <span aria-hidden>·</span>
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  hasUnsavedChanges ? "bg-fill-warning" : "bg-fill-success",
                )}
              />
              <span className="shrink-0">
                {hasUnsavedChanges ? "Edited" : "Saved"}
              </span>
            </>
          )}
        </p>
      </div>

      {/* Below the title when narrow, so the title keeps its room */}
      {primaryAction && (
        <div className="stack-row gap-1 order-last basis-full @md:order-none @md:basis-auto">
          {primaryAction}
        </div>
      )}

      <PlaylistMenu
        saved={saved}
        trackCount={tracks.length}
        onSaveCopy={() =>
          linked && setEditing({ mode: "new", value: `${linked.name} (copy)` })
        }
      />
    </form>
  );
};

const PlaylistMenu = ({
  saved,
  trackCount,
  onSaveCopy,
}: {
  saved: SavedPlaylists;
  trackCount: number;
  onSaveCopy: () => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  // Clearing can't be undone, so it asks first
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);
  const { linked, hasUnsavedChanges } = saved;

  return (
    <Popover
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        setIsConfirmingClear(false);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="shrink-0"
          aria-label="Playlist options"
        >
          <VscEllipsis />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        hideArrow
        hideCloseButton
        className="w-64 p-1"
        // Otherwise it pulls focus from the name field "Save a copy" opens
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {isConfirmingClear ? (
          <div className="p-2">
            <p className="text-sm font-medium">
              Clear all {trackCount} {trackCount === 1 ? "track" : "tracks"}?
            </p>
            <p className="mt-1 text-xs text-secondary">
              {linked
                ? `"${linked.name}" stays in your saved playlists.`
                : "This playlist isn't saved, so they'll be gone."}
            </p>
            <div className="stack-row justify-end gap-1 mt-3">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsConfirmingClear(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  saved.clear();
                  setIsOpen(false);
                }}
              >
                Clear
              </Button>
            </div>
          </div>
        ) : (
          <>
            {linked && (
              <PopoverMenuItem
                label="Save a copy"
                description={`Keeps "${linked.name}" as it is`}
                icon={<VscCopy />}
                onClick={onSaveCopy}
              />
            )}
            {hasUnsavedChanges && (
              <PopoverMenuItem
                label="Discard changes"
                description="Go back to the saved tracks"
                icon={<VscDiscard />}
                onClick={saved.discardChanges}
              />
            )}
            {/* Not a PopoverMenuItem, which would close the menu */}
            <button
              type="button"
              className="flex w-full items-start gap-2 px-3 py-2 text-sm text-left rounded cursor-pointer transition-colors text-fill-destructive hover:bg-surface-primary-hover"
              onClick={() => setIsConfirmingClear(true)}
            >
              <VscClearAll className="shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">Clear tracks</p>
                <p className="text-xs text-tertiary">Start an empty playlist</p>
              </div>
            </button>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
};
