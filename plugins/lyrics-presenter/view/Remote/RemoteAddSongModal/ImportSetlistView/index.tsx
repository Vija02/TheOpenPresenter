import { Button, Skeleton, cn } from "@repo/ui";
import { useCallback, useEffect, useMemo, useState } from "react";
import { typeidUnboxed } from "typeid-js";

import { Song } from "../../../../src";
import { usePluginAPI } from "../../../pluginApi";
import { AddSongFooter } from "../AddSongFooter";
import { Setlist, setlistSourceLabel } from "../MainView/setlistTypes";
import { useAddSongScene } from "../useAddSongScene";
import { SetlistSongDetail } from "./SetlistSongDetail";
import { SetlistSongRow } from "./SetlistSongRow";
import { SongLyricsLoader } from "./SongLyricsLoader";
import { SetlistChoice, SetlistImportData } from "./types";
import { useSetlistMatches } from "./useSetlistMatches";

export const ImportSetlistView = ({ setlist }: { setlist: Setlist }) => {
  const pluginApi = usePluginAPI();
  const pluginId = pluginApi.pluginContext.pluginId;
  const { close, addLinkedSavedSong, addSong } = useAddSongScene();
  const { isLoading, getMatches } = useSetlistMatches();

  const [choices, setChoices] = useState<Record<string, SetlistChoice>>({});
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const isPublicAccess = pluginApi.isPublicAccess;

  // Seed a default decision per song once the songbook has loaded: reuse the
  // first matching entry if any, otherwise import (and save) fresh
  useEffect(() => {
    if (isLoading) return;
    setChoices((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const song of setlist.content) {
        if (next[song.key]) continue;
        const matches = getMatches(song.matchSource, song.matchExternalId);
        next[song.key] = matches.length
          ? { mode: "match", savedSong: matches[0]! }
          : { mode: "import", saveToSongbook: !isPublicAccess };
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [isLoading, isPublicAccess, getMatches, setlist.content]);

  // Store fetched lyrics onto a choice once (keeping any user edits).
  const seedData = useCallback((key: string, data: SetlistImportData) => {
    setChoices((prev) => {
      const ch = prev[key];
      if (!ch || ch.mode !== "import" || ch.data) return prev;
      return { ...prev, [key]: { ...ch, data } };
    });
  }, []);

  // The songs that will be imported fresh (not reused from the songbook)
  const importSongs = useMemo(
    () =>
      setlist.content.filter(
        (song) => (choices[song.key]?.mode ?? "import") === "import",
      ),
    [setlist.content, choices],
  );

  const importsReady = importSongs.every((song) => {
    const ch = choices[song.key];
    return ch?.mode === "import" && !!ch.data;
  });

  const activeSong =
    setlist.content.find((song) => song.key === activeKey) ??
    setlist.content[0] ??
    null;

  const matchedCount = setlist.content.filter(
    (song) => choices[song.key]?.mode === "match",
  ).length;

  const submit = () => {
    for (const song of setlist.content) {
      const choice = choices[song.key];
      if (choice?.mode === "match") {
        addLinkedSavedSong(choice.savedSong);
        continue;
      }
      const data = choice?.mode === "import" ? choice.data : undefined;
      if (!data) continue;
      const save = choice?.mode === "import" ? choice.saveToSongbook : true;

      const imported: Song = {
        id: typeidUnboxed(),
        title: data.title,
        author: data.author,
        content: data.content,
        _imported: true,
        import: {
          ...song.importSetting,
          importedData: {
            title: data.title,
            author: data.author,
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
      {importSongs.map((song) => (
        <SongLyricsLoader
          key={song.key}
          song={song}
          connectionId={setlist.connectionId}
          pluginId={pluginId}
          onLoaded={(data) => seedData(song.key, data)}
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
            : setlist.content.map((song, index) =>
                isEditing ? (
                  <button
                    key={song.key}
                    type="button"
                    onClick={() => setActiveKey(song.key)}
                    title={song.title}
                    className={cn(
                      "flex items-center justify-center rounded-md w-full py-2 text-sm cursor-pointer hover:bg-surface-primary-hover",
                      activeSong?.key === song.key &&
                        "bg-surface-primary-active font-bold",
                    )}
                  >
                    {index + 1}
                  </button>
                ) : (
                  <SetlistSongRow
                    key={song.key}
                    title={song.title}
                    sourceLabel={setlistSourceLabel[setlist.source]}
                    matches={getMatches(song.matchSource, song.matchExternalId)}
                    choice={choices[song.key]}
                    isActive={activeSong?.key === song.key}
                    onSelect={() => setActiveKey(song.key)}
                  />
                ),
              )}
        </div>

        <div className="flex-1 min-w-0 md:min-h-0 md:overflow-y-auto">
          {activeSong && (
            <SetlistSongDetail
              key={activeSong.key}
              sourceLabel={setlistSourceLabel[setlist.source]}
              matches={getMatches(
                activeSong.matchSource,
                activeSong.matchExternalId,
              )}
              choice={choices[activeSong.key]}
              onChange={(choice) =>
                setChoices((prev) => ({ ...prev, [activeSong.key]: choice }))
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
