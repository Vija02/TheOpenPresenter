import { Skeleton } from "@repo/ui";
import { VscChevronDown, VscChevronRight } from "react-icons/vsc";

import { trpc } from "../../../trpc";

export type Setlist = {
  id: any;
  title: string;
  content: { id: number; title: string }[];
};

export const ImportPlaylist = ({
  onSelectSetlist,
  open,
  onToggleOpen,
}: {
  onSelectSetlist: (setlist: Setlist) => void;
  open: boolean;
  onToggleOpen: () => void;
}) => {
  const { data: playlistData, isLoading } =
    trpc.lyricsPresenter.myworshiplist.playlist.useQuery();

  return (
    <div className="min-w-0 mb-4">
      <button
        type="button"
        onClick={onToggleOpen}
        className="flex items-center gap-2 w-full text-left cursor-pointer"
      >
        {open ? <VscChevronDown /> : <VscChevronRight />}
        <p className="font-bold">Import a setlist</p>
        <p className="text-xs text-secondary">(powered by MyWorshipList)</p>
      </button>

      {open && (
        <div className="flex gap-2 overflow-x-auto pb-2 mt-2">
          {isLoading &&
            Array.from(new Array(6)).map((_, i) => (
              <Skeleton key={i} className="w-56 h-28 shrink-0" />
            ))}
          {playlistData?.data.map((playlist: any) => (
            <div
              key={playlist.id}
              data-testid="ly-setlist-card"
              className="w-56 shrink-0 p-2 cursor-pointer rounded border border-stroke hover:bg-surface-primary-hover"
              onClick={() => onSelectSetlist(playlist)}
            >
              <p className="font-bold overflow-hidden text-ellipsis whitespace-nowrap">
                {playlist?.title}
              </p>
              <div className="text-secondary text-sm mt-1 max-h-24 overflow-y-auto">
                {playlist.content.map((content: any) => (
                  <p
                    key={content.id}
                    className="text-ellipsis overflow-hidden whitespace-nowrap"
                  >
                    - {content.title}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
