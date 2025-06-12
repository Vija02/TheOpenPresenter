import { Link, Skeleton, cn } from "@repo/ui";
import { useState } from "react";

import { trpc } from "../../trpc";

export const ImportPlaylist = ({
  setSelectedPlaylistSongIds,
}: {
  setSelectedPlaylistSongIds: React.Dispatch<
    React.SetStateAction<number[] | null>
  >;
}) => {
  const [selectedPlaylistId, setSelectedPlaylistId] = useState(null);
  const { data: playlistData, isLoading } =
    trpc.lyricsPresenter.playlist.useQuery();

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
          Array.from(new Array(10)).map((_, i) => (
            <Skeleton key={i} className="w-full h-20" />
          ))}
        {playlistData?.data.map((playlist: any) => (
          <div
            key={playlist.id}
            className={cn(
              "p-1 cursor-pointer flex-1 whitespace-nowrap border border-stroke hover:bg-surface-primary-hover",
              selectedPlaylistId === playlist.id && "bg-surface-primary-hover",
            )}
            onClick={() => {
              setSelectedPlaylistId(playlist.id);
              setSelectedPlaylistSongIds(
                playlistData.data
                  .find((x: any) => x.id === playlist.id)
                  .content.map((x: any) => x.id),
              );
            }}
          >
            <p className="font-bold overflow-hidden text-ellipsis">
              {playlist?.title}
            </p>
            <div className="text-secondary">
              {playlist.content.map((content: any) => (
                <p key={content.id} className="text-ellipsis overflow-hidden">
                  - {content.title}
                </p>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
