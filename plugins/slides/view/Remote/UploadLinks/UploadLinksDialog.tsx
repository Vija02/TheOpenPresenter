import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui";

import { UploadLinksPanel } from "./UploadLinksPanel";

export const UploadLinksDialog = ({
  isOpen,
  onOpenChange,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) => (
  <Dialog open={isOpen} onOpenChange={onOpenChange}>
    <DialogContent size="lg">
      <DialogHeader>
        <DialogTitle>Collect slides from others</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <UploadLinksPanel />
      </DialogBody>
      <DialogFooter />
    </DialogContent>
  </Dialog>
);
