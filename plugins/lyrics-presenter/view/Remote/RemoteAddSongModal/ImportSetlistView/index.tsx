import { Button, Skeleton } from "@repo/ui";
import { useEffect, useState } from "react";
import { typeidUnboxed } from "typeid-js";

import { AddSongFooter } from "../AddSongFooter";
import { Setlist } from "../ImportPlaylist";
import { useAddSongScene } from "../useAddSongScene";
import { SetlistSongDetail } from "./SetlistSongDetail";
import { SetlistSongRow } from "./SetlistSongRow";
import { SetlistChoice } from "./types";
import { useSetlistMatches } from "./useSetlistMatches";

export const ImportSetlistView = ({ setlist }: { setlist: Setlist }) => {
  const { close, addLinkedSavedSong, addSong } = useAddSongScene();
  const { isLoading, matchesByMwlId } = useSetlistMatches();

  const [choices, setChoices] = useState<Record<number, SetlistChoice>>({});
  const [activeId, setActiveId] = useState<number | null>(null);

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

  const activeSong =
    setlist.content.find((c) => c.id === activeId) ??
    setlist.content[0] ??
    null;

  const matchedCount = setlist.content.filter(
    (c) => choices[c.id]?.mode === "match",
  ).length;

  const submit = () => {
    setlist.content.forEach((c) => {
      const choice = choices[c.id];
      if (choice?.mode === "match") {
        addLinkedSavedSong(choice.savedSong);
      } else {
        const save = choice?.mode === "import" ? choice.saveToSongbook : true;
        addSong(
          {
            id: typeidUnboxed(),
            title: "",
            content: "",
            _imported: false,
            addToSongbook: save,
            import: { type: "myworshiplist", meta: { id: c.id } },
            setting: { displayType: "sections" },
          },
          false,
        );
      }
    });
    close();
  };

  return (
    <div className="stack-col items-stretch gap-3 mb-4 md:flex-1 md:min-h-0">
      <p className="text-sm text-secondary">
        {setlist.content.length} song(s) from{" "}
        <span className="font-medium">{setlist.title}</span> will be added
        {matchedCount > 0 ? `, ${matchedCount} already in your songbook` : ""}.
      </p>

      <div className="flex flex-col md:flex-row gap-3 md:min-h-0 md:flex-1">
        <div className="md:basis-[300px] shrink-0 stack-col items-stretch gap-1 border border-stroke rounded-lg p-1 min-h-0 overflow-y-auto max-h-[50vh] md:max-h-none">
          {isLoading
            ? Array.from(new Array(4)).map((_, i) => (
                <Skeleton key={i} className="w-full h-12" />
              ))
            : setlist.content.map((c) => (
                <SetlistSongRow
                  key={c.id}
                  title={c.title}
                  matches={matchesByMwlId.get(String(c.id)) ?? []}
                  choice={choices[c.id]}
                  isActive={activeSong?.id === c.id}
                  onSelect={() => setActiveId(c.id)}
                />
              ))}
        </div>

        <div className="flex-1 min-w-0 md:min-h-0 md:overflow-y-auto">
          {activeSong && (
            <SetlistSongDetail
              key={activeSong.id}
              mwlId={Number(activeSong.id)}
              title={activeSong.title}
              matches={matchesByMwlId.get(String(activeSong.id)) ?? []}
              choice={choices[activeSong.id]}
              onChange={(choice) =>
                setChoices((prev) => ({ ...prev, [activeSong.id]: choice }))
              }
            />
          )}
        </div>
      </div>

      <AddSongFooter>
        <Button variant="success" onClick={submit}>
          Import
        </Button>
        <Button variant="outline" onClick={close}>
          Cancel
        </Button>
      </AddSongFooter>
    </div>
  );
};
