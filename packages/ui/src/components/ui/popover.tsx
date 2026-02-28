import { cn } from "@/lib/utils";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { XIcon } from "lucide-react";
import * as React from "react";

import { useDialogPortalContainerContext } from "./dialog";
import "./popover.css";

function Popover({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Root>) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

function PopoverTrigger({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

function PopoverClose({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Close>) {
  return <PopoverPrimitive.Close data-slot="popover-close" {...props} />;
}

function PopoverContent({
  className,
  align = "center",
  sideOffset = 4,
  hideCloseButton = false,
  hideArrow = false,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content> & {
  hideCloseButton?: boolean;
  hideArrow?: boolean;
}) {
  // Debt: Rename this context to be generic
  const container = useDialogPortalContainerContext();

  return (
    <PopoverPrimitive.Portal
      container={
        container ?? (typeof window !== "undefined" ? document.body : undefined)
      }
    >
      <PopoverPrimitive.Content
        data-slot="popover-content"
        align={align}
        sideOffset={sideOffset}
        className={cn("ui--popover", className)}
        {...props}
      >
        {props.children}
        {!hideCloseButton && (
          <PopoverPrimitive.Close
            className="ui--popover__close"
            aria-label="Close"
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </PopoverPrimitive.Close>
        )}
        {!hideArrow && (
          <PopoverPrimitive.Arrow className="ui--popover__arrow" />
        )}
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  );
}

function PopoverAnchor({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Anchor>) {
  return <PopoverPrimitive.Anchor data-slot="popover-anchor" {...props} />;
}

export { Popover, PopoverTrigger, PopoverClose, PopoverContent, PopoverAnchor };
