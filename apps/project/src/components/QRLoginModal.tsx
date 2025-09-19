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
import { EventSourcePlus } from "event-source-plus";
import { useState } from "react";
import QRCode from "react-qr-code";
import { useDisposable } from "use-disposable";

export type QRLoginModalPropTypes = {
  next: string;
};

const QRLoginModal = ({ next }: QRLoginModalPropTypes) => {
  const { isOpen, onToggle } = useOverlayToggle();
  const [qrId, setQRId] = useState<string | null>(null);

  useDisposable(() => {
    if (isOpen) {
      const eventSource = new EventSourcePlus("/qr-auth/request", {
        retryStrategy: "on-error",
      });
      const controller = eventSource.listen({
        onMessage(ev) {
          try {
            const data = JSON.parse(ev.data);
            if (data.id) {
              setQRId(data.id);
            }
            if (data.done) {
              window.location.href = `/qr-auth/login?token=${data.token}&next=${encodeURIComponent(next)}`;
            }
          } catch (e) {
            // Keep alive
          }
        },
      });

      return [undefined, () => controller.abort()];
    }
    return [undefined, () => {}];
  }, [next]);

  return (
    <Dialog open={isOpen ?? false} onOpenChange={onToggle ?? (() => {})}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>QR Login</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="center flex-col items-center gap-4">
            <p className="text-sm">Scan with your mobile phone to log in</p>
            {!qrId && (
              <Skeleton className="w-full max-w-[256px] aspect-square bg-gray-200 animate-pulse rounded-sm" />
            )}
            {qrId && (
              <div className="w-full">
                <QRCode
                  className="h-auto max-w-full w-full max-h-[256px]"
                  value={`${window.location.origin}/qr-auth/auth?id=${qrId}`}
                />
              </div>
            )}
          </div>
        </DialogBody>
        <DialogFooter />
      </DialogContent>
    </Dialog>
  );
};

export default QRLoginModal;
