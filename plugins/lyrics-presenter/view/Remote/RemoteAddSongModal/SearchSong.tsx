import { Input, LoadingInline, Pagination, cn } from "@repo/ui";
import { useEffect, useRef, useState } from "react";
import Highlighter from "react-highlight-words";
import { useDebounce } from "use-debounce";

import { trpc } from "../../trpc";
import "./SearchSong.css";

export const SearchSong = ({
  initialValue,
  selectedSongId,
  setSelectedSongId,
}: {
  initialValue: string | null;
  selectedSongId: number | null;
  setSelectedSongId: React.Dispatch<React.SetStateAction<number | null>>;
}) => {
  const [selectedSource, setSelectedSource] = useState("Any");

  const [searchInput, setSearchInput] = useState(initialValue ?? "");
  const [debouncedSearchInput] = useDebounce(searchInput, 200);

  const [pageOffset, setPageOffset] = useState(0);

  const { data: songData, isFetching } = trpc.lyricsPresenter.search.useQuery({
    title: debouncedSearchInput,
    page: pageOffset + 1,
  });

  const focusElement = useRef<HTMLInputElement>(null);
  useEffect(() => {
    void (focusElement.current && focusElement.current!.focus());
  }, [focusElement]);

  return (
    <div className="flex">
      <div className="hidden sm:flex flex-col pr-4 border-r-stroke border-r">
        <p className="font-bold mb-2">Sources</p>
        {["Any", "MyWorshipList"].map((source) => (
          <div
            className={cn(
              "px-2 py-1 cursor-pointer hover:bg-surface-primary-hover",
              source === selectedSource && "bg-surface-primary-active",
            )}
            key={source}
            onClick={() => {
              setSelectedSource(source);
            }}
          >
            <p>{source}</p>
          </div>
        ))}
        <p className="text-xs text-center text-tertiary pt-4">
          More coming soon...
        </p>
      </div>
      <div className="sm:pl-4 w-full">
        <div className="relative">
          <Input
            ref={focusElement}
            className="mb-2 pr-8"
            placeholder="Search a song..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          <div
            className={cn(
              "absolute top-0 right-3 bottom-0 flex items-center",
              !isFetching && "hidden",
            )}
          >
            <LoadingInline />
          </div>
        </div>
        <div>
          {songData?.data.map((x: any) => (
            <div
              key={x.id}
              className={cn(
                "cursor-pointer py-1 px-1 hover:bg-surface-primary-hover",
                selectedSongId === x.id && "bg-surface-primary-active",
              )}
              onClick={() => {
                setSelectedSongId(x.id);
              }}
            >
              <p className="leading-4">
                {/* @ts-ignore */}
                <Highlighter
                  searchWords={[debouncedSearchInput]}
                  autoEscape={true}
                  textToHighlight={x.title}
                />
              </p>
              <p className="text-xs text-secondary">
                {/* @ts-ignore */}
                <Highlighter
                  searchWords={[debouncedSearchInput]}
                  autoEscape={true}
                  textToHighlight={x.author !== "" ? x.author : "-"}
                />
              </p>
            </div>
          ))}

          <div className="flex mt-5 justify-center">
            {songData?.totalPage > 1 && (
              <Pagination
                onPageChange={(page) => {
                  setPageOffset(page.selected);
                }}
                pageCount={songData?.totalPage}
                forcePage={pageOffset}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
