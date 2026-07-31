import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui";
import QRCode from "react-qr-code";

type PhonePresentModalProps = {
  isOpen: boolean;
  onToggle: () => void;
  remoteUrl: string;
  onPresentHere: () => void;
};

const PhonePresentModal = ({
  isOpen,
  onToggle,
  remoteUrl,
  onPresentHere,
}: PhonePresentModalProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onToggle}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Present from your phone</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="center flex-col items-center gap-4 my-1">
            <p className="text-sm text-secondary text-center">
              Scan this QR code to open the remote on your phone, then present
              on this screen.
            </p>
            <div className="w-full bg-white p-4 rounded-md">
              <QRCode
                className="h-auto max-w-full w-full max-h-[256px]"
                value={remoteUrl}
              />
            </div>
            <span hidden data-testid="phone-present-qr-url">
              {remoteUrl}
            </span>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onToggle}>
            Cancel
          </Button>
          <Button onClick={onPresentHere}>Present on this screen</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PhonePresentModal;
