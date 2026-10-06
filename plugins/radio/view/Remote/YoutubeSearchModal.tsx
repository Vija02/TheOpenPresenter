import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Skeleton,
} from "@repo/ui";
import { useState } from "react";
import { FaCheck, FaPlus, FaYoutube } from "react-icons/fa";

import { trpc } from "../trpc";
import "./YoutubeSearchModal.css";

export type YoutubeSearchResult = {
  videoId: string;
  title: string;
  author?: string;
  duration?: number;
  thumbnailUrl?: string;
};

type YoutubeSearchModalProps = {
  isOpen: boolean;
  onToggle: () => void;
  searchQuery: string;
  onAdd: (result: YoutubeSearchResult) => void;
};

const YoutubeSearchModal = ({
  isOpen,
  onToggle,
  searchQuery,
  onAdd,
}: YoutubeSearchModalProps) => {
  const { data, isLoading, error } = trpc.musicPlayer.search.useQuery(
    { query: searchQuery },
    { enabled: isOpen && !!searchQuery },
  );

  const [addedIds, setAddedIds] = useState<string[]>([]);

  const onOpenChange = () => {
    setAddedIds([]);
    onToggle();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent size="xl" className="max-w-[1200px] min-h-[70%]">
        <DialogHeader>
          <DialogTitle>
            <div className="stack-row">
              <FaYoutube className="text-[#FF0000] size-4" />
              <span>Search YouTube for "{searchQuery}"</span>
            </div>
          </DialogTitle>
        </DialogHeader>
        <DialogBody>
          {error && (
            <p className="my-10 text-fill-destructive text-center">
              Unable to search YouTube right now.
            </p>
          )}
          {data && data.results.length === 0 && (
            <p className="my-10 text-secondary text-center">
              No results found.
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {isLoading &&
              Array.from(new Array(8)).map((_, i) => (
                <div key={i} className="pl-radio--youtube-skeleton">
                  <Skeleton />
                  <Skeleton />
                  <Skeleton />
                  <Skeleton />
                </div>
              ))}
            {data?.results.map((result) => {
              const isAdded = addedIds.includes(result.videoId);

              return (
                <button
                  key={result.videoId}
                  type="button"
                  className="p-1 pb-4 text-left cursor-pointer hover:bg-gray-100 disabled:cursor-default"
                  disabled={isAdded}
                  onClick={() => {
                    onAdd(result);
                    setAddedIds((ids) => [...ids, result.videoId]);
                  }}
                >
                  <div className="relative">
                    <img
                      src={result.thumbnailUrl}
                      className="aspect-video w-full object-cover"
                      alt={result.title}
                    />
                    {result.durationText && (
                      <div className="absolute bottom-2 right-2 bg-gray-900 opacity-90 text-white rounded-sm px-1 text-xs font-semibold">
                        {result.durationText}
                      </div>
                    )}
                    <div className="absolute top-2 right-2 stack-row gap-1 bg-gray-900/90 text-white rounded-sm px-1.5 py-0.5 text-xs font-semibold">
                      {isAdded ? (
                        <>
                          <FaCheck /> Added
                        </>
                      ) : (
                        <>
                          <FaPlus /> Add
                        </>
                      )}
                    </div>
                  </div>
                  <p className="mt-2 mb-1 text-base overflow-hidden line-clamp-2 text-ellipsis">
                    {result.title}
                  </p>
                  <p className="text-gray-600">{result.author}</p>
                </button>
              );
            })}
          </div>
        </DialogBody>

        <DialogFooter>
          <Button onClick={onOpenChange}>
            {addedIds.length > 0 ? `Done (${addedIds.length} added)` : "Close"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default YoutubeSearchModal;
