import { Button, Link, Skeleton, cn } from "@repo/ui";
import { useCallback, useState } from "react";

import { trpc } from "../../trpc";

const MAX_VISIBLE = 6;
type Id = string | number;

export const ImportPlaylist = ({
  setSelectedPlaylistSongIds,
}: {
  setSelectedPlaylistSongIds: React.Dispatch<
    React.SetStateAction<number[] | null>
  >;
}) => {
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<Id | null>(null);
  const [expandedPlaylistIds, setExpandedPlaylistIds] = useState<Set<Id>>(
    new Set(),
  );

  const { data: playlistData, isLoading } =
    trpc.lyricsPresenter.playlist.useQuery();

  const toggleExpand = useCallback((id: Id) => {
    setExpandedPlaylistIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

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
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(200px, 100%), 1fr))",
        }}
      >
        {isLoading &&
          Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="w-full h-20" />
          ))}

        {playlistData?.data.map((playlist: any) => {
          const pid: Id = playlist.id;
          const isExpanded = expandedPlaylistIds.has(pid);

          const allItems = Array.isArray(playlist?.content)
            ? playlist.content
            : [];
          const visible = isExpanded
            ? allItems
            : allItems.slice(0, MAX_VISIBLE);
          const hiddenCount = Math.max(allItems.length - MAX_VISIBLE, 0);
          const listId = `playlist-${String(pid)}`;

          return (
            <div
              key={String(pid)}
              className={cn(
                "p-1 cursor-pointer flex-1 whitespace-nowrap border border-stroke hover:bg-surface-primary-hover",
                selectedPlaylistId === pid && "bg-surface-primary-hover",
              )}
              onClick={() => {
                setSelectedPlaylistId(pid);

                const found = playlistData?.data.find((x: any) => x.id === pid);
                const songIds: number[] = Array.isArray(found?.content)
                  ? found.content
                      .map((x: any) => x?.id)
                      .filter(
                        (v: unknown): v is number => typeof v === "number",
                      )
                  : [];

                setSelectedPlaylistSongIds(songIds.length ? songIds : null);
              }}
            >
              <p className="font-bold overflow-hidden text-ellipsis">
                {playlist?.title}
              </p>

              <div className="text-secondary">
                <div id={listId}>
                  {visible.map((content: any) => (
                    <p
                      key={String(content.id)}
                      className="text-ellipsis overflow-hidden"
                    >
                      - {content?.title}
                    </p>
                  ))}
                </div>

                {/* collapsed: N more + Show more */}
                {!isExpanded && hiddenCount > 0 && (
                  <p className="mt-1 text-ellipsis overflow-hidden text-xs text-secondary">
                    …and {hiddenCount} more{" "}
                    <Button
                      variant="link"
                      size="xs"
                      aria-controls={listId}
                      aria-expanded={isExpanded}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpand(pid);
                      }}
                      className="px-0 h-auto align-baseline cursor-pointer"
                    >
                      Show all
                    </Button>
                  </p>
                )}

                {/* expanded: Show less */}
                {isExpanded && allItems.length > MAX_VISIBLE && (
                  <div className="mt-1">
                    <Button
                      variant="link"
                      size="xs"
                      aria-controls={listId}
                      aria-expanded={isExpanded}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpand(pid);
                      }}
                      className="px-0 h-auto text-secondary align-baseline cursor-pointer"
                    >
                      Show less
                    </Button>
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
