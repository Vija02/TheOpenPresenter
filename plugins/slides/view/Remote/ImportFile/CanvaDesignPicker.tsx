import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  LoadingInline,
  PopConfirm,
} from "@repo/ui";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FaLinkSlash } from "react-icons/fa6";
import { SiCanva } from "react-icons/si";

import { usePluginAPI } from "../../pluginApi";
import { trpc } from "../../trpc";

export type CanvaDesignSelection = {
  designId: string;
  title: string;
};

const log = (...args: unknown[]) => console.log("[canva:picker]", ...args);

export const CanvaDesignPicker = ({
  isOpen,
  onClose,
  onSelected,
  connectedByName,
  onDisconnected,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelected: (design: CanvaDesignSelection) => void;
  connectedByName?: string | null;
  onDisconnected?: () => void;
}) => {
  const pluginApi = usePluginAPI();
  const pluginId = pluginApi.pluginContext.pluginId;

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const disconnectMutation = trpc.slides.canvaDisconnect.useMutation();

  const handleDisconnect = useCallback(async () => {
    await disconnectMutation.mutateAsync({ pluginId });
    onDisconnected?.();
    onClose();
  }, [disconnectMutation, pluginId, onDisconnected, onClose]);

  const listQuery = trpc.slides.canvaListDesigns.useInfiniteQuery(
    {
      pluginId,
      query: debouncedSearch || undefined,
    },
    {
      enabled: isOpen,
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      // Canva thumbnail URLs expire after 15 minutes, so don't serve a stale
      // list (with broken images) to a picker that was left open.
      staleTime: 10 * 60 * 1000,
      initialCursor: undefined,
    },
  );

  const designs = useMemo(
    () => listQuery.data?.pages.flatMap((p) => p.items) ?? [],
    [listQuery.data],
  );

  useEffect(() => {
    log("render", {
      isOpen,
      queryEnabled: isOpen,
      isLoading: listQuery.isLoading,
      isFetching: listQuery.isFetching,
      isError: listQuery.isError,
      error: listQuery.error?.message,
      designCount: designs.length,
      hasNextPage: listQuery.hasNextPage,
    });
  }, [
    isOpen,
    listQuery.isLoading,
    listQuery.isFetching,
    listQuery.isError,
    listQuery.error?.message,
    designs.length,
    listQuery.hasNextPage,
  ]);

  const handleSelect = useCallback(
    (designId: string, title: string) => {
      log("selected", { designId, title });
      onSelected({ designId, title });
      onClose();
    },
    [onSelected, onClose],
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="3xl" className="md:max-w-[900px] md:min-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SiCanva className="size-5 text-[#00C4CC]" />
            Import from Canva
          </DialogTitle>
        </DialogHeader>
        <DialogBody className="pt-0 flex-1 flex flex-col min-h-0">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search your Canva designs..."
            className="w-full border border-stroke rounded-sm px-3 py-2 mb-4 shrink-0"
          />

          {listQuery.isError && (
            <p className="text-red-600 text-sm">
              {listQuery.error?.message ?? "Could not load your Canva designs."}
            </p>
          )}

          {listQuery.isLoading ? (
            <div className="flex-1 min-h-0 flex items-center justify-center">
              <LoadingInline />
            </div>
          ) : designs.length === 0 ? (
            <div className="flex-1 min-h-0 flex items-center justify-center">
              <p className="text-secondary text-center">No designs found.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 flex-1 min-h-0 overflow-y-auto auto-rows-min content-start">
              {designs.map((design) => (
                <div
                  key={design.id}
                  onClick={() => handleSelect(design.id, design.title)}
                  className="cursor-pointer border border-stroke rounded-sm overflow-hidden hover:border-blue-400"
                >
                  {design.thumbnailUrl ? (
                    <img
                      src={design.thumbnailUrl}
                      alt={design.title}
                      className="w-full aspect-video object-cover bg-slate-100"
                    />
                  ) : (
                    <div className="w-full aspect-video bg-slate-100 flex items-center justify-center">
                      <SiCanva className="size-8 text-[#00C4CC]" />
                    </div>
                  )}
                  <div className="p-2">
                    <p
                      className="text-sm font-medium truncate"
                      title={design.title}
                    >
                      {design.title}
                    </p>
                    {design.pageCount != null && (
                      <p className="text-xs text-secondary">
                        {design.pageCount}{" "}
                        {design.pageCount === 1 ? "page" : "pages"}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {listQuery.hasNextPage && (
            <div className="flex justify-center mt-4 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={listQuery.isFetchingNextPage}
                onClick={() => listQuery.fetchNextPage()}
              >
                {listQuery.isFetchingNextPage ? <LoadingInline /> : "Load more"}
              </Button>
            </div>
          )}
        </DialogBody>
        <DialogFooter className="sm:justify-between items-center">
          <div className="flex items-center gap-3 min-w-0">
            <PopConfirm
              title="Disconnect Canva?"
              description="Everyone in this organization will lose access to these designs until Canva is connected again. Slides you have already imported are unaffected."
              okText="Disconnect"
              onConfirm={handleDisconnect}
            >
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disconnectMutation.isPending}
              >
                {disconnectMutation.isPending ? (
                  <LoadingInline className="size-3" />
                ) : (
                  <FaLinkSlash />
                )}
                Disconnect
              </Button>
            </PopConfirm>
            {connectedByName && (
              <span
                className="text-xs text-secondary truncate"
                title={`Connected as ${connectedByName}`}
              >
                Connected as {connectedByName}
              </span>
            )}
          </div>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
