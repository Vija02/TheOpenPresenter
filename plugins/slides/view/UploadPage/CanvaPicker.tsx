import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  LoadingInline,
} from "@repo/ui";
import { useEffect, useState } from "react";

import type { CanvaConnection } from "./useCanvaConnections";

type Design = { id: string; title: string; thumbnailUrl: string | null };

export const CanvaPicker = ({
  token,
  uploaderName,
  send,
  isOpen,
  onClose,
  connections,
  isConnecting,
  onRetryConnect,
}: {
  token: string;
  uploaderName: string;
  send: (run: () => Promise<Response>) => Promise<boolean>;
  isOpen: boolean;
  onClose: () => void;
  connections: CanvaConnection[] | null;
  isConnecting: boolean;
  onRetryConnect: () => void;
}) => {
  const [designs, setDesigns] = useState<Design[] | null>(null);

  const connectionId = connections?.[0]?.id;

  useEffect(() => {
    setDesigns(null);
    if (!connectionId) return;

    let cancelled = false;

    void (async () => {
      const res = await fetch(
        `/plugin/slides/canva-designs/${token}?connectionId=${connectionId}`,
      );
      if (!res.ok || cancelled) return;
      const body = await res.json();
      if (!cancelled) setDesigns(body.items ?? []);
    })();

    return () => {
      cancelled = true;
    };
  }, [connectionId, token]);

  const body = () => {
    if (connections === null || isConnecting) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 py-10 text-secondary">
          <LoadingInline className="size-6" />
          <span className="text-sm">
            Finish connecting Canva in the window that opened.
          </span>
          <button
            type="button"
            className="text-sm font-medium text-link cursor-pointer hover:underline"
            onClick={onRetryConnect}
          >
            Reopen Canva
          </button>
        </div>
      );
    }

    if (connections.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 py-10 text-secondary">
          <span className="text-sm">
            If nothing opened, your browser may have blocked the popup.
          </span>
          <button
            type="button"
            className="text-sm font-medium text-link cursor-pointer hover:underline"
            onClick={onRetryConnect}
          >
            Try again
          </button>
        </div>
      );
    }

    if (designs === null) {
      return (
        <div className="flex items-center justify-center py-10">
          <LoadingInline className="size-6" />
        </div>
      );
    }

    if (designs.length === 0) {
      return (
        <p className="py-10 text-center text-sm text-secondary">
          No designs found in your Canva account.
        </p>
      );
    }

    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {designs.map((design) => (
          <button
            key={design.id}
            type="button"
            className="flex flex-col gap-1 p-2 rounded-lg border border-stroke hover:bg-surface-secondary hover:border-blue-400 text-left cursor-pointer transition-colors"
            onClick={async () => {
              onClose();
              await send(() =>
                fetch(`/plugin/slides/canva-import/${token}`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "x-top-csrf-protection": "1",
                  },
                  body: JSON.stringify({
                    connectionId,
                    designId: design.id,
                    title: design.title,
                    uploaderName: uploaderName || undefined,
                  }),
                }),
              );
            }}
          >
            {design.thumbnailUrl ? (
              <img
                src={design.thumbnailUrl}
                alt=""
                className="w-full aspect-[4/3] object-cover rounded"
              />
            ) : (
              <div className="w-full aspect-[4/3] rounded bg-surface-secondary" />
            )}
            <span className="text-xs truncate">{design.title}</span>
          </button>
        ))}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="3xl">
        <DialogHeader>
          <DialogTitle>Choose a Canva design</DialogTitle>
        </DialogHeader>
        <DialogBody>{body()}</DialogBody>
        <DialogFooter />
      </DialogContent>
    </Dialog>
  );
};
