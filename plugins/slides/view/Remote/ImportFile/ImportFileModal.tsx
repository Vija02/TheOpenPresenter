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

type Props = {
  replaceImportId?: string;
};

const ImportFileModal = ({ replaceImportId }: Props) => {
  const { isOpen, onToggle } = useOverlayToggle();

  return (
    <Dialog open={isOpen ?? false} onOpenChange={onToggle ?? (() => {})}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>
            {replaceImportId ? "Replace slide" : "Add slide"}
          </DialogTitle>
        </DialogHeader>
        <DialogBody>
          <p className="font-medium">Select source:</p>
          <ImportFilePicker replaceImportId={replaceImportId} />
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
