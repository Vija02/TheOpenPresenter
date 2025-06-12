import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  OverlayToggleComponentProps,
} from "@repo/ui";

import { ImportFilePicker } from "./ImportFilePicker";

export type ImportFileModalPropTypes = Partial<OverlayToggleComponentProps>;

const ImportFileModal = ({ isOpen, onToggle }: ImportFileModalPropTypes) => {
  return (
    <Dialog open={isOpen ?? false} onOpenChange={onToggle ?? (() => {})}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Replace slide</DialogTitle>
        </DialogHeader>
        <DialogBody>
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
