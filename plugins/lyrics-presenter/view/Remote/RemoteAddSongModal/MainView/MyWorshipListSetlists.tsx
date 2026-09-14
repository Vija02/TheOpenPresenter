import { Skeleton } from "@repo/ui";
import { useMemo } from "react";

import { trpc } from "../../../trpc";
import { SetlistCard } from "./SetlistCard";
import { Setlist } from "./setlistTypes";

type MwlPlaylist = {
  id: number | string;
  title: string;
  content: { id: number; title: string; author?: string | null }[];
};

export const MyWorshipListSetlists = ({
  onSelectSetlist,
}: {
  onSelectSetlist: (setlist: Setlist) => void;
}) => {
  const { data, isLoading } =
    trpc.lyricsPresenter.myworshiplist.playlist.useQuery();

  const setlists = useMemo<Setlist[]>(
    () =>
      ((data?.data ?? []) as MwlPlaylist[]).map((playlist) => ({
        source: "myworshiplist" as const,
        id: String(playlist.id),
        title: playlist?.title ?? "Untitled setlist",
        subtitle: null,
        content: (playlist.content ?? []).map((song) => ({
          key: String(song.id),
          title: song.title,
          author: song.author ?? null,
          matchSource: "myworshiplist",
          matchExternalId: String(song.id),
          importSetting: {
            type: "myworshiplist" as const,
            meta: { id: Number(song.id) },
          },
        })),
      })),
    [data],
  );

  if (isLoading) {
    return (
      <div className="flex gap-2 overflow-x-auto pb-2">
        {Array.from(new Array(6)).map((_, i) => (
          <Skeleton key={i} className="w-56 h-28 shrink-0" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {setlists.map((setlist) => (
        <SetlistCard
          key={setlist.id}
          setlist={setlist}
          onSelect={() => onSelectSetlist(setlist)}
        />
      ))}
    </div>
  );
};
