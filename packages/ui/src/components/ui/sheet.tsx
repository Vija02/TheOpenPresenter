import { cn } from "@/lib/utils";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";
import * as React from "react";

import { useDialogPortalContainerContext } from "./dialog";
import "./sheet.css";

function Sheet({
  children,
  ...props
}: React.ComponentProps<typeof BaseDialog.Root>) {
  return (
    <BaseDialog.Root data-slot="sheet" {...props}>
      {children}
    </BaseDialog.Root>
  );
}

function SheetTrigger({
  ...props
}: React.ComponentProps<typeof BaseDialog.Trigger>) {
  return <BaseDialog.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose({
  ...props
}: React.ComponentProps<typeof BaseDialog.Close>) {
  return <BaseDialog.Close data-slot="sheet-close" {...props} />;
}

function SheetPortal({
  className,
  keepMounted = false,
  ...props
}: React.ComponentProps<typeof BaseDialog.Portal>) {
  return (
    <BaseDialog.Portal
      data-slot="sheet-portal"
      className={cn("ui--sheet-portal", className)}
      keepMounted={keepMounted}
      {...props}
    />
  );
}

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof BaseDialog.Backdrop>) {
  return (
    <BaseDialog.Backdrop
      data-slot="sheet-overlay"
      className={cn("ui--sheet-overlay", className)}
      {...props}
    />
  );
}

function SheetContent({
  className,
  children,
  side = "right",
  hideCloseButton = false,
  ...props
}: React.ComponentProps<typeof BaseDialog.Popup> & {
  side?: "top" | "right" | "bottom" | "left";
  hideCloseButton?: boolean;
}) {
  const container = useDialogPortalContainerContext();

  return (
    <SheetPortal container={container ?? undefined}>
      <SheetOverlay />
      <BaseDialog.Popup
        data-slot="sheet-content"
        className={cn(
          "ui--sheet-content",
          side === "right" && "ui--sheet-content__right",
          side === "left" && "ui--sheet-content__left",
          side === "top" && "ui--sheet-content__top",
          side === "bottom" && "ui--sheet-content__bottom",
          className,
        )}
        {...props}
      >
        {children}
        {!hideCloseButton && (
          <BaseDialog.Close className={cn("ui--sheet-close")}>
            <XIcon className="size-4" />
            <span className="sr-only">Close</span>
          </BaseDialog.Close>
        )}
      </BaseDialog.Popup>
    </SheetPortal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("ui--sheet-header", className)}
      {...props}
    />
  );
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("ui--sheet-footer", className)}
      {...props}
    />
  );
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof BaseDialog.Title>) {
  return (
    <BaseDialog.Title
      data-slot="sheet-title"
      className={cn("ui--sheet-title", className)}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof BaseDialog.Description>) {
  return (
    <BaseDialog.Description
      data-slot="sheet-description"
      className={cn("ui--sheet-description", className)}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
  SheetPortal,
  SheetOverlay,
};
