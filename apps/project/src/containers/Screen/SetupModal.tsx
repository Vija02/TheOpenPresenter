import { ScreenFragment } from "@repo/graphql";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Link,
  useOverlayToggle,
} from "@repo/ui";
import QRCodeLib from "qrcode";
import { useCallback, useMemo } from "react";
import { VscCopy, VscDesktopDownload, VscLinkExternal } from "react-icons/vsc";
import QRCode from "react-qr-code";
import { toast } from "react-toastify";

const buildScreenRendererUrl = (orgSlug: string, screenSlug: string) =>
  `${window.location.origin}/render/s/${orgSlug}/${screenSlug}`;

const buildScreenControlUrl = (orgSlug: string, screenSlug: string) =>
  `${window.location.origin}/o/${orgSlug}/screens/${screenSlug}/control`;

type Props = {
  orgSlug: string;
  screen: ScreenFragment;
};

export const SetupModal = ({ orgSlug, screen }: Props) => {
  const { isOpen, onToggle } = useOverlayToggle();

  const rendererUrl = useMemo(
    () => buildScreenRendererUrl(orgSlug, screen.slug),
    [orgSlug, screen.slug],
  );
  const controlUrl = useMemo(
    () => buildScreenControlUrl(orgSlug, screen.slug),
    [orgSlug, screen.slug],
  );

  const onCopy = useCallback(async (url: string, label: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Failed to copy");
    }
  }, []);

  const onDownloadQR = useCallback(async () => {
    const canvas = document.createElement("canvas");
    try {
      await QRCodeLib.toCanvas(canvas, controlUrl, {
        width: 1024,
        margin: 2,
        color: { dark: "#000000", light: "#ffffff" },
      });
    } catch (e: any) {
      toast.error("Failed to generate QR: " + (e?.message ?? "unknown"));
      return;
    }

    canvas.toBlob((blob) => {
      if (!blob) {
        toast.error("Failed to encode PNG");
        return;
      }
      const pngUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = pngUrl;
      link.download = `${screen.slug}-control-qr.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(pngUrl);
    }, "image/png");
  }, [controlUrl, screen.slug]);

  return (
    <Dialog open={isOpen ?? false} onOpenChange={onToggle ?? (() => {})}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Set up {screen.name}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <ol className="space-y-6">
            <li>
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-semibold text-tertiary">1.</span>
                <h3 className="font-semibold">
                  Open the screen on your display device
                </h3>
              </div>
              <p className="text-sm text-secondary mt-1 ml-6">
                On the device that will show the projection, open the screen URL
                below. Leave it running fullscreen — it will pick up whatever
                you assign on this page.
              </p>
              <div className="ml-6 mt-2 flex flex-wrap items-center gap-2">
                <Link variant="unstyled" isExternal href={rendererUrl}>
                  <Button variant="default">
                    <VscLinkExternal />
                    Open screen
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  onClick={() => onCopy(rendererUrl, "Screen URL")}
                >
                  <VscCopy />
                  Copy URL
                </Button>
              </div>
            </li>

            <li>
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-semibold text-tertiary">2.</span>
                <h3 className="font-semibold">Print the control QR code</h3>
              </div>
              <p className="text-sm text-secondary mt-1 ml-6">
                Stick this near the screen so anyone with a phone can scan it to
                take control.
              </p>
              <div className="ml-6 mt-3 flex flex-col items-start gap-3">
                <div className="bg-white p-4 rounded border border-stroke">
                  <QRCode value={controlUrl} size={192} />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="default" onClick={onDownloadQR}>
                    <VscDesktopDownload />
                    Download QR (PNG)
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => onCopy(controlUrl, "Control URL")}
                  >
                    <VscCopy />
                    Copy URL
                  </Button>
                </div>
              </div>
            </li>
          </ol>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onToggle}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
