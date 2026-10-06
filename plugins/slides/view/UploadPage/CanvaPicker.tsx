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

type Design = { id: string; title: string; thumbnailUrl: string | null };

export const CanvaPicker = ({
  token,
  uploaderName,
  send,
  isOpen,
  onClose,
  grantId,
  isSigningIn,
  signInError,
  onRetrySignIn,
}: {
  token: string;
  uploaderName: string;
  send: (run: () => Promise<Response>) => Promise<boolean>;
  isOpen: boolean;
  onClose: () => void;
  /** The visitor's one-time sign-in, once it has finished */
  grantId: string | null;
  isSigningIn: boolean;
  signInError: string | null;
  onRetrySignIn: () => void;
}) => {
  const [designs, setDesigns] = useState<Design[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setDesigns(null);
    setLoadError(null);
    if (!grantId) return;

    let cancelled = false;

    void (async () => {
      const res = await fetch(
        `/plugin/slides/canva-designs/${token}?grantId=${grantId}`,
      );
      const body = await res.json().catch(() => ({}));
      if (cancelled) return;
      if (!res.ok) {
        // e.g. the sign-in expired while the dialog was left open
        setLoadError(body.error ?? "Couldn't load your Canva designs.");
        return;
      }
      setDesigns(body.items ?? []);
    })();

    return () => {
      cancelled = true;
    };
  }, [grantId, token]);

  const body = () => {
    if (isSigningIn) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 py-10 text-secondary">
          <LoadingInline className="size-6" />
          <span className="text-sm">
            Finish signing in to Canva in the window that opened.
          </span>
          <button
            type="button"
            className="text-sm font-medium text-link cursor-pointer hover:underline"
            onClick={onRetrySignIn}
          >
            Reopen Canva
          </button>
        </div>
      );
    }

    if (!grantId || loadError) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 py-10 text-secondary">
          <span className="text-sm">
            {loadError ??
              (signInError
                ? `Canva sign-in failed: ${signInError}`
                : "If nothing opened, your browser may have blocked the popup.")}
          </span>
          <button
            type="button"
            className="text-sm font-medium text-link cursor-pointer hover:underline"
            onClick={onRetrySignIn}
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
                    grantId,
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
