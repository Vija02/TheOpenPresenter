import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
};

export const PublicAccessNoticeDialog = ({
  isOpen,
  onClose,
  title = "Action disabled",
  message = "You're viewing this project via its public link. This action is disabled for public viewers.",
}: Props) => {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <DialogBody>{message}</DialogBody>
        <DialogFooter>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
