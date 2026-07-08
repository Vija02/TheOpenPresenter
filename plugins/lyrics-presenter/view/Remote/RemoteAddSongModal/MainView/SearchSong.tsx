import { Input, LoadingInline, Pagination, Skeleton, cn } from "@repo/ui";
import { useEffect, useMemo, useRef, useState } from "react";
import Highlighter from "react-highlight-words";
import { VscClose } from "react-icons/vsc";
import { useDebounce } from "use-debounce";

import { SavedSong } from "../../../../src";
import { usePluginAPI } from "../../../pluginApi";
import { trpc } from "../../../trpc";
import "./SearchSong.css";

export const SearchSong = ({
  initialValue,
  selectedSavedSong,
  setSelectedSavedSong,
  onSelectImportSong,
  onSearchingChange,
}: {
  initialValue: string | null;
  selectedSavedSong: SavedSong | null;
  setSelectedSavedSong: React.Dispatch<React.SetStateAction<SavedSong | null>>;
  onSelectImportSong: (id: number) => void;
  onSearchingChange?: (searching: boolean) => void;
}) => {
  const pluginApi = usePluginAPI();
  const pluginId = pluginApi.pluginContext.pluginId;

  const [searchInput, setSearchInput] = useState(initialValue ?? "");
  const [debouncedSearchInput] = useDebounce(searchInput, 200);
  const [pageOffset, setPageOffset] = useState(0);

  const hasQuery = debouncedSearchInput.trim().length > 0;

  const savedSongsQuery = trpc.lyricsPresenter.savedSongs.list.useQuery({
    pluginId,
  });

  const { data: songData, isLoading: isSearchLoading } =
    trpc.lyricsPresenter.myworshiplist.search.useQuery(
      { title: debouncedSearchInput, page: pageOffset + 1 },
      { enabled: hasQuery },
    );

  const localResults = useMemo(() => {
    const all = savedSongsQuery.data ?? [];
    const q = debouncedSearchInput.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        (s.author ?? "").toLowerCase().includes(q),
    );
  }, [savedSongsQuery.data, debouncedSearchInput]);

  const myWorshipListResults: any[] = hasQuery ? (songData?.data ?? []) : [];

  const isLoading = savedSongsQuery.isLoading || (hasQuery && isSearchLoading);

  const focusElement = useRef<HTMLInputElement>(null);
  useEffect(() => {
    void (focusElement.current && focusElement.current!.focus());
  }, [focusElement]);

  useEffect(() => {
    onSearchingChange?.(hasQuery);
  }, [hasQuery, onSearchingChange]);

  const sectionHeader = (label: string) => (
    <p className="font-bold text-sm px-1 mb-1">{label}</p>
  );

  return (
    <div
      className={cn(
        "w-full gap-2 flex flex-col",
        hasQuery && "flex-1 min-h-0",
      )}
    >
      <div className="relative">
        <Input
          ref={focusElement}
          className="pr-8"
          placeholder="Search songs..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <div
          className="absolute top-0 bottom-0 flex items-center"
          style={{ right: 8 }}
        >
          {isLoading ? (
            <LoadingInline />
          ) : searchInput ? (
            <button
              type="button"
              onClick={() => setSearchInput("")}
              className="text-secondary hover:text-primary p-1 cursor-pointer"
              title="Clear search"
            >
              <VscClose />
            </button>
          ) : null}
        </div>
      </div>

      {hasQuery && (
        <div className="flex-1 min-h-0 overflow-y-auto">
          {savedSongsQuery.isLoading && (
            <div className="stack-col gap-1">
              {Array.from(new Array(8)).map((_, i) => (
                <Skeleton key={i} className="w-full h-10" />
              ))}
            </div>
          )}

          {/* Songbook (yours) */}
          {!savedSongsQuery.isLoading && (
            <div>
              {sectionHeader("Songbook")}
              {localResults.length === 0 && (
                <p className="text-secondary text-sm px-1 py-2">
                  No matching songs in your songbook.
                </p>
              )}
              {localResults.map((saved) => (
                <div
                  key={`local-${saved.id}`}
                  className={cn(
                    "cursor-pointer py-1 px-1 hover:bg-surface-primary-hover",
                    selectedSavedSong?.id === saved.id &&
                      "bg-surface-primary-active",
                  )}
                  onClick={() => {
                    setSelectedSavedSong(saved);
                  }}
                >
                  <p className="leading-4">
                    {/* @ts-ignore */}
                    <Highlighter
                      searchWords={[debouncedSearchInput]}
                      autoEscape={true}
                      textToHighlight={saved.title || "Untitled"}
                    />
                  </p>
                  <p className="text-xs text-secondary">
                    {/* @ts-ignore */}
                    <Highlighter
                      searchWords={[debouncedSearchInput]}
                      autoEscape={true}
                      textToHighlight={saved.author ? saved.author : "-"}
                    />
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Import from MyWorshipList (third-party) */}
          {myWorshipListResults.length > 0 && (
            <div className="mt-3 pt-3 border-t border-stroke">
              <div className="flex items-baseline gap-2 px-1 mb-1">
                <p className="font-bold text-sm">Import</p>
                <p className="text-xs text-secondary">
                  (powered by MyWorshipList)
                </p>
              </div>
              {myWorshipListResults.map((x: any) => (
                <div
                  key={`mwl-${x.id}`}
                  className="cursor-pointer py-1 px-1 hover:bg-surface-primary-hover"
                  onClick={() => onSelectImportSong(x.id)}
                >
                  <p className="leading-4">
                    {/* @ts-ignore */}
                    <Highlighter
                      searchWords={[debouncedSearchInput]}
                      autoEscape={true}
                      textToHighlight={x.title || "Untitled"}
                    />
                  </p>
                  <p className="text-xs text-secondary">
                    {/* @ts-ignore */}
                    <Highlighter
                      searchWords={[debouncedSearchInput]}
                      autoEscape={true}
                      textToHighlight={x.author || "-"}
                    />
                  </p>
                </div>
              ))}

              {(songData?.totalPage ?? 0) > 1 && (
                <div className="flex mt-3 justify-center">
                  <Pagination
                    onPageChange={(page) => {
                      setPageOffset(page.selected);
                    }}
                    pageCount={songData?.totalPage}
                    forcePage={pageOffset}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
