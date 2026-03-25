import { cn } from "@/lib/utils";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Slottable } from "@radix-ui/react-slot";
import { type VariantProps, cva } from "class-variance-authority";
import { XIcon } from "lucide-react";
import * as React from "react";

import "./dialog.css";

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn("ui--dialog-overlay", className)}
      {...props}
    />
  );
}

const dialogContentVariants = cva("ui--dialog-content", {
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

type InteractOutsideEvent = Parameters<
  NonNullable<
    React.ComponentProps<typeof DialogPrimitive.Content>["onInteractOutside"]
  >
>[0];

function DialogContent({
  className,
  children,
  size,
  onInteractOutside,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> &
  VariantProps<typeof dialogContentVariants>) {
  const container = useDialogPortalContainerContext();

  // Handle interact outside - prevent closing if clicking on another dialog/modal
  const handleInteractOutside = React.useCallback(
    (event: InteractOutsideEvent) => {
      const target = event.target as HTMLElement;
      if (target?.closest('[data-slot="dialog-content"]')) {
        event.preventDefault();
        return;
      }
      onInteractOutside?.(event);
    },
    [onInteractOutside],
  );

  return (
    <DialogPortal
      data-slot="dialog-portal"
      container={
        container ?? (typeof window !== "undefined" ? document.body : undefined)
      }
    >
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(dialogContentVariants({ size, className }))}
        onInteractOutside={handleInteractOutside}
        {...props}
      >
        <DialogPrimitive.Description className="hidden" />
        <Slottable>{children}</Slottable>
        <DialogPrimitive.Close className="ui--dialog-content__close">
          <XIcon />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
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
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      tabIndex={0}
      autoFocus
      className={cn("ui--dialog-title", className)}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
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

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
  DialogPortalContainerContext,
  useDialogPortalContainerContext,
};
