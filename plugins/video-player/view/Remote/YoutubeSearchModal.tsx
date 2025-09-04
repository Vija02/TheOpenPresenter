import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Skeleton,
  useOverlayToggle,
} from "@repo/ui";
import { FaYoutube } from "react-icons/fa";
import type { YTNodes } from "youtubei.js";

import { trpc } from "../trpc";
import "./YoutubeSearchModal.css";

export type YoutubeSearchModalPropTypes = {
  searchQuery: string;
  onVideoSelect: (videoId: string, metadata: VideoMetaData) => void;
};

type VideoMetaData = {
  title?: string;
  thumbnailUrl?: string;
  duration?: number;
};

const YoutubeSearchModal = ({
  searchQuery,
  onVideoSelect,
}: YoutubeSearchModalPropTypes) => {
  const { isOpen, onToggle, resetData } = useOverlayToggle();

  const { data, isLoading } = trpc.videoPlayer.search.useQuery(
    {
      title: searchQuery,
    },
    { enabled: isOpen },
  );

  const onSelect = (videoId: string, metadata: VideoMetaData) => {
    onVideoSelect(videoId, metadata);
    onToggle?.();
    resetData?.();
  };

  return (
    <Dialog open={isOpen ?? false} onOpenChange={onToggle ?? (() => {})}>
      <DialogContent size="xl" className="max-w-[1200px] min-h-[70%]">
        <DialogHeader>
          <DialogTitle>
            <div className="stack-row">
              <FaYoutube className="text-[#FF0000] size-4" />
              <span>Youtube Search</span>
            </div>
          </DialogTitle>
        </DialogHeader>
        <DialogBody>
          {data && data.results.length === 0 && (
            <p className="my-10 text-gray-800 text-center">No results found.</p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {isLoading &&
              Array.from(new Array(9)).map((_, i) => (
                <div key={i} className="pl--video-player-youtube-skeleton">
                  <Skeleton />
                  <Skeleton />
                  <Skeleton />
                  <Skeleton />
                </div>
              ))}
            {data &&
              data.results
                .filter((result) => result.type === "Video")
                .map((result) => {
                  const res = result as YTNodes.Video;

                  return (
                    <div
                      key={res.video_id}
                      className="p-1 pb-4 cursor-pointer hover:bg-gray-100"
                      onClick={() =>
                        onSelect(res.video_id, {
                          title: res.title.text,
                          thumbnailUrl:
                            res.thumbnails[res.thumbnails.length - 1]?.url,
                          duration: res.duration.seconds,
                        })
                      }
                    >
                      <div className="relative">
                        <img
                          src={res.thumbnails[res.thumbnails.length - 1]?.url}
                          className="aspect-video w-full"
                          alt={res.title.text}
                        />
                        {res.thumbnail_overlays.find(
                          (x) => x.type === "ThumbnailOverlayTimeStatus",
                        ) && (
                          <div className="absolute bottom-2 right-2 bg-gray-900 opacity-90 text-white rounded-sm px-1 text-xs font-semibold">
                            {
                              (res.thumbnail_overlays.find(
                                (x) => x.type === "ThumbnailOverlayTimeStatus",
                              ) as YTNodes.ThumbnailOverlayTimeStatus)!.text
                            }
                          </div>
                        )}
                      </div>
                      <p className="mt-2 mb-1 text-base overflow-hidden line-clamp-2 text-ellipsis">
                        {res.title.text}
                      </p>
                      <p className="text-gray-600">{res.author.name}</p>
                      <div className="stack-row text-gray-600">
                        <span>{res.short_view_count?.text}</span>
                        <span>•</span>
                        <span>{res.published?.text}</span>
                      </div>
                    </div>
                  );
                })}
          </div>
        </DialogBody>

        <DialogFooter></DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default YoutubeSearchModal;
