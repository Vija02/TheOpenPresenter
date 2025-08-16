import { Link, Skeleton, cn } from "@repo/ui";
import { useState } from "react";
import { trpc } from "../../trpc";

const MAX_VISIBLE = 6;

export const ImportPlaylist = ({
                                 setSelectedPlaylistSongIds,
                               }: {
  setSelectedPlaylistSongIds: React.Dispatch<
    React.SetStateAction<number[] | null>
  >;
}) => {
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<number | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const { data: playlistData, isLoading } = trpc.lyricsPresenter.playlist.useQuery();

  const toggleExpand = (id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div>
      <p className="text-lg font-bold">Recent Playlist</p>
      <p className="pb-2 text-xs">
        From{" "}
        <Link href="https://myworshiplist.com" isExternal>
          MyWorshipList
        </Link>
      </p>

      <div
        className="grid gap-1"
        style={{
          gridTemplateColumns: "repeat(auto-fit, minmax(min(200px, 100%), 1fr))",
        }}
      >
        {isLoading &&
          Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="w-full h-20" />
          ))}

        {playlistData?.data.map((playlist: any) => {
          const isExpanded = expandedIds.has(playlist.id as number);
          const allItems = playlist.content ?? [];
          const visible = isExpanded ? allItems : allItems.slice(0, MAX_VISIBLE);
          const hiddenCount = Math.max(allItems.length - MAX_VISIBLE, 0);
          const listId = `playlist-${playlist.id}`;

          return (
            <div
              key={playlist.id}
              className={cn(
                "p-1 cursor-pointer flex-1 whitespace-nowrap border border-stroke hover:bg-surface-primary-hover",
                selectedPlaylistId === playlist.id && "bg-surface-primary-hover"
              )}
              onClick={() => {
                setSelectedPlaylistId(playlist.id);
                setSelectedPlaylistSongIds(
                  playlistData.data
                    .find((x: any) => x.id === playlist.id)
                    .content.map((x: any) => x.id)
                );
              }}
            >
              <p className="font-bold overflow-hidden text-ellipsis">
                {playlist?.title}
              </p>

              <div className="text-secondary">
                <div id={listId}>
                  {visible.map((content: any) => (
                    <p key={content.id} className="text-ellipsis overflow-hidden">
                      - {content.title}
                    </p>
                  ))}
                </div>

                {!isExpanded && hiddenCount > 0 && (
                  <p className="text-ellipsis overflow-hidden text-xs text-muted-foreground">
                    …and {hiddenCount} more{" "}
                    <button
                      type="button"
                      className="underline hover:no-underline"
                      aria-controls={listId}
                      aria-expanded={isExpanded}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpand(playlist.id);
                      }}
                    >
                      Show more
                    </button>
                  </p>
                )}

                {isExpanded && allItems.length > MAX_VISIBLE && (
                  <div className="mt-1">
                    <button
                      type="button"
                      className="text-xs underline text-muted-foreground hover:no-underline"
                      aria-controls={listId}
                      aria-expanded={isExpanded}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpand(playlist.id);
                      }}
                    >
                      Show less
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

