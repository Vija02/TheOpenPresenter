import { VscChevronDown } from "react-icons/vsc";

import type { Song } from "../../../src/types";

type SongTitleProps = {
  songs: Song[];
  song: Song | undefined;
  liveSongId: string | null | undefined;
  onPick: (songId: string) => void;
};

export const SongTitle = ({
  songs,
  song,
  liveSongId,
  onPick,
}: SongTitleProps) => (
  <div className="relative inline-flex max-w-full items-center gap-1.5 hover:opacity-80">
    <h2 className="truncate text-xl font-semibold">
      {song?.title ?? "Pick a song"}
    </h2>
    <VscChevronDown aria-hidden className="size-4 shrink-0 opacity-40" />
    <select
      data-testid="ly-musician-song"
      aria-label="Song"
      className="absolute inset-0 cursor-pointer opacity-0"
      value={song?.id ?? ""}
      onChange={(e) => onPick(e.target.value)}
    >
      {!song && <option value="">Nothing live yet</option>}
      {songs.map((x) => (
        <option key={x.id} value={x.id}>
          {x.id === liveSongId ? `● ${x.title}` : x.title}
        </option>
      ))}
    </select>
  </div>
);
