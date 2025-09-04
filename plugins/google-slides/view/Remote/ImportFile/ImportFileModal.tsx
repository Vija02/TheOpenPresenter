import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  useOverlayToggle,
} from "@repo/ui";

import { ImportFilePicker } from "./ImportFilePicker";

const ImportFileModal = () => {
  const { isOpen, onToggle } = useOverlayToggle();

  return (
    <Dialog open={isOpen ?? false} onOpenChange={onToggle ?? (() => {})}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Replace slide</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <p className="font-medium">Select source:</p>
          <ImportFilePicker />
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onToggle}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ImportFileModal;
