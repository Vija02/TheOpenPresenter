import { Button, Skeleton, cn } from "@repo/ui";
import { useCallback, useEffect, useMemo, useState } from "react";
import { typeidUnboxed } from "typeid-js";

import { Song } from "../../../../src";
import { trpc } from "../../../trpc";
import { AddSongFooter } from "../AddSongFooter";
import { Setlist } from "../MainView/ImportPlaylist";
import { useAddSongScene } from "../useAddSongScene";
import { SetlistSongDetail } from "./SetlistSongDetail";
import { SetlistSongRow } from "./SetlistSongRow";
import { SetlistChoice, SetlistImportData } from "./types";
import { useSetlistMatches } from "./useSetlistMatches";

// Invisible loader
// Here so we don't need to put the hooks in a loop
const SongLyricsLoader = ({
  mwlId,
  onLoaded,
}: {
  mwlId: number;
  onLoaded: (data: SetlistImportData) => void;
}) => {
  const { data } = trpc.lyricsPresenter.getSong.useQuery({ id: mwlId });
  useEffect(() => {
    if (data) {
      onLoaded({
        title: data.title,
        author: data.author,
        content: data.content,
        originalContent: data.content,
      });
    }
  }, [data, onLoaded]);
  return null;
};

export const ImportSetlistView = ({ setlist }: { setlist: Setlist }) => {
  const { close, addLinkedSavedSong, addSong } = useAddSongScene();
  const { isLoading, matchesByMwlId } = useSetlistMatches();

  const [choices, setChoices] = useState<Record<number, SetlistChoice>>({});
  const [activeId, setActiveId] = useState<number | null>(null);

  const [isEditing, setIsEditing] = useState(false);

  // Seed a default decision per song once the songbook has loaded: reuse the
  // first matching entry if any, otherwise import (and save) fresh
  useEffect(() => {
    if (isLoading) return;
    setChoices((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const c of setlist.content) {
        if (next[c.id]) continue;
        const matches = matchesByMwlId.get(String(c.id)) ?? [];
        next[c.id] = matches.length
          ? { mode: "match", savedSong: matches[0]! }
          : { mode: "import", saveToSongbook: true };
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [isLoading, matchesByMwlId, setlist.content]);

  // Store fetched lyrics onto a choice once (keeping any user edits).
  const seedData = useCallback((id: number, data: SetlistImportData) => {
    setChoices((prev) => {
      const ch = prev[id];
      if (!ch || ch.mode !== "import" || ch.data) return prev;
      return { ...prev, [id]: { ...ch, data } };
    });
  }, []);

  // The songs that will be imported fresh (not reused from the songbook)
  const importIds = useMemo(
    () =>
      setlist.content
        .filter((c) => (choices[c.id]?.mode ?? "import") === "import")
        .map((c) => c.id),
    [setlist.content, choices],
  );

  const importsReady = importIds.every((id) => {
    const ch = choices[id];
    return ch?.mode === "import" && !!ch.data;
  });

  const activeSong =
    setlist.content.find((c) => c.id === activeId) ??
    setlist.content[0] ??
    null;

  const matchedCount = setlist.content.filter(
    (c) => choices[c.id]?.mode === "match",
  ).length;

  const submit = () => {
    for (const c of setlist.content) {
      const choice = choices[c.id];
      if (choice?.mode === "match") {
        addLinkedSavedSong(choice.savedSong);
        continue;
      }
      const data = choice?.mode === "import" ? choice.data : undefined;
      if (!data) continue;
      const save = choice?.mode === "import" ? choice.saveToSongbook : true;
      const mwlId = Number(c.id);
      const imported: Song = {
        id: typeidUnboxed(),
        title: data.title,
        author: data.author,
        content: data.content,
        _imported: true,
        import: {
          type: "myworshiplist",
          meta: { id: mwlId },
          importedData: {
            id: mwlId,
            title: data.title,
            author: data.author,
            year: null,
            content: data.content,
            original_chord: "",
          },
        },
        setting: { displayType: "sections" },
      };
      addSong(imported, save);
    }
    close();
  };

  return (
    <div className="stack-col items-stretch gap-3 mb-4 md:flex-1 md:min-h-0">
      {/* Load import lyrics */}
      {importIds.map((id) => (
        <SongLyricsLoader
          key={id}
          mwlId={Number(id)}
          onLoaded={(data) => seedData(id, data)}
        />
      ))}

      <p className="text-sm text-secondary">
        {setlist.content.length} song(s) from{" "}
        <span className="font-medium">{setlist.title}</span> will be added
        {matchedCount > 0 ? `, ${matchedCount} already in your songbook` : ""}.
      </p>

      <div className="flex flex-col md:flex-row gap-3 md:min-h-0 md:flex-1">
        <div
          className={cn(
            "shrink-0 stack-col items-stretch gap-1 border border-stroke rounded-lg p-1 min-h-0 overflow-y-auto max-h-[50vh] md:max-h-none",
            isEditing ? "md:basis-[56px]" : "md:basis-[300px]",
          )}
        >
          {isLoading
            ? Array.from(new Array(4)).map((_, i) => (
                <Skeleton key={i} className="w-full h-12" />
              ))
            : setlist.content.map((c, index) =>
                isEditing ? (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setActiveId(c.id)}
                    title={c.title}
                    className={cn(
                      "flex items-center justify-center rounded-md w-full py-2 text-sm cursor-pointer hover:bg-surface-primary-hover",
                      activeSong?.id === c.id &&
                        "bg-surface-primary-active font-bold",
                    )}
                  >
                    {index + 1}
                  </button>
                ) : (
                  <SetlistSongRow
                    key={c.id}
                    title={c.title}
                    matches={matchesByMwlId.get(String(c.id)) ?? []}
                    choice={choices[c.id]}
                    isActive={activeSong?.id === c.id}
                    onSelect={() => setActiveId(c.id)}
                  />
                ),
              )}
        </div>

        <div className="flex-1 min-w-0 md:min-h-0 md:overflow-y-auto">
          {activeSong && (
            <SetlistSongDetail
              key={activeSong.id}
              matches={matchesByMwlId.get(String(activeSong.id)) ?? []}
              choice={choices[activeSong.id]}
              onChange={(choice) =>
                setChoices((prev) => ({ ...prev, [activeSong.id]: choice }))
              }
              isEditingLyrics={isEditing}
              setIsEditingLyrics={setIsEditing}
            />
          )}
        </div>
      </div>

      <AddSongFooter>
        {isEditing ? (
          <Button variant="success" onClick={() => setIsEditing(false)}>
            Confirm edit
          </Button>
        ) : (
          <Button
            variant="success"
            disabled={isLoading || !importsReady}
            onClick={submit}
          >
            {importsReady ? "Import" : "Loading..."}
          </Button>
        )}
        <Button variant="outline" onClick={close}>
          Cancel
        </Button>
      </AddSongFooter>
    </div>
  );
};
