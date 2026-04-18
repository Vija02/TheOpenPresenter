import { cn } from "@/lib/utils";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { type VariantProps, cva } from "class-variance-authority";
import { XIcon } from "lucide-react";
import * as React from "react";

import "./dialog.css";

function Dialog({
  children,
  ...props
}: React.ComponentProps<typeof BaseDialog.Root>) {
  return (
    <BaseDialog.Root data-slot="dialog" {...props}>
      {children}
    </BaseDialog.Root>
  );
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof BaseDialog.Trigger>) {
  return <BaseDialog.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({
  className,
  keepMounted = false,
  ...props
}: React.ComponentProps<typeof BaseDialog.Portal>) {
  return (
    <BaseDialog.Portal
      data-slot="dialog-portal"
      className={cn("ui--dialog-portal", className)}
      keepMounted={keepMounted}
      {...props}
    />
  );
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof BaseDialog.Close>) {
  return <BaseDialog.Close data-slot="dialog-close" {...props} />;
}

function DialogBackdrop({
  className,
  ...props
}: React.ComponentProps<typeof BaseDialog.Backdrop>) {
  return (
    <BaseDialog.Backdrop
      data-slot="dialog-backdrop"
      className={cn("ui--dialog-backdrop", className)}
      {...props}
    />
  );
}

const dialogPopupVariants = cva("ui--dialog-popup", {
  variants: {
    size: {
      default: "md:max-w-md",
      sm: "md:max-w-sm",
      md: "md:max-w-md",
      lg: "md:max-w-lg",
      xl: "md:max-w-xl",
      "2xl": "md:max-w-2xl",
      "3xl": "md:max-w-3xl",
      full: "max-w-full",
    },
  },
  defaultVariants: {
    size: "default",
  },
});

function DialogContent({
  className,
  children,
  size,
  ...props
}: React.ComponentProps<typeof BaseDialog.Popup> &
  VariantProps<typeof dialogPopupVariants>) {
  const container = useDialogPortalContainerContext();

  return (
    <DialogPortal container={container ?? undefined}>
      <DialogBackdrop />
      <BaseDialog.Popup
        data-slot="dialog-content"
        className={cn(dialogPopupVariants({ size, className }))}
        {...props}
      >
        {children}
        <BaseDialog.Close className="ui--dialog-popup__close">
          <XIcon />
          <span className="sr-only">Close</span>
        </BaseDialog.Close>
      </BaseDialog.Popup>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("ui--dialog-header", className)}
      {...props}
    />
  );
}

function DialogBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-body"
      className={cn("ui--dialog-body", className)}
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn("ui--dialog-footer", className)}
      {...props}
    />
  );
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof BaseDialog.Title>) {
  return (
    <BaseDialog.Title
      data-slot="dialog-title"
      className={cn("ui--dialog-title", className)}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof BaseDialog.Description>) {
  return (
    <BaseDialog.Description
      data-slot="dialog-description"
      className={cn("ui--dialog-description", className)}
      {...props}
    />
  );
}

const DialogPortalContainerContext = React.createContext<HTMLElement | null>(
  null,
);
const useDialogPortalContainerContext = () =>
  React.useContext(DialogPortalContainerContext);

// Re-export with aliases for backwards compatibility
const DialogOverlay = DialogBackdrop;
const DialogPopup = DialogContent;

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogOverlay,
  DialogBackdrop,
  DialogPortal,
  DialogPopup,
  DialogTitle,
  DialogTrigger,
  DialogPortalContainerContext,
  useDialogPortalContainerContext,
};
