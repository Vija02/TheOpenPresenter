import { cn } from "@/lib/utils";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { ChevronRightIcon, XIcon } from "lucide-react";
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

type PopoverMenuItemProps = Omit<React.ComponentProps<"button">, "children"> & {
  label: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  href?: string;
  isExternal?: boolean;
};

function PopoverMenuItem({
  label,
  description,
  icon,
  className,
  type = "button",
  href,
  isExternal,
  ...props
}: PopoverMenuItemProps) {
  const sharedClassName = cn(
    "flex w-full items-start gap-2 px-3 py-2 text-sm text-left rounded transition-colors cursor-pointer hover:bg-surface-primary-hover focus-visible:bg-surface-primary-hover focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed text-primary hover:no-underline",
    className,
  );

  const content = (
    <>
      {icon && <span className="shrink-0 mt-0.5">{icon}</span>}
      <div className="min-w-0 flex-1">
        <p className="font-medium">{label}</p>
        {description && <p className="text-xs text-tertiary">{description}</p>}
      </div>
    </>
  );

  return (
    <PopoverClose asChild>
      {href ? (
        <a
          href={href}
          data-slot="popover-menu-item"
          className={sharedClassName}
          {...(isExternal ? { target: "_blank", rel: "noopener" } : {})}
          {...(props as React.ComponentProps<"a">)}
        >
          {content}
        </a>
      ) : (
        <button
          type={type}
          data-slot="popover-menu-item"
          className={sharedClassName}
          {...props}
        >
          {content}
        </button>
      )}
    </PopoverClose>
  );
}

type PopoverSubMenuProps = {
  label: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  disabled?: boolean;
};

function PopoverSubMenu({
  label,
  description,
  icon,
  children,
  className,
  contentClassName,
  disabled,
}: PopoverSubMenuProps) {
  const [open, setOpen] = React.useState(false);
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const clickPointerType = React.useRef<string | null>(null);

  const [isNarrow, setIsNarrow] = React.useState(false);
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const query = window.matchMedia("(max-width: 767px)");
    const sync = () => setIsNarrow(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  const cancelClose = React.useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const scheduleClose = React.useCallback(() => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 150);
  }, [cancelClose]);

  React.useEffect(() => cancelClose, [cancelClose]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        type="button"
        data-slot="popover-sub-trigger"
        disabled={disabled}
        onPointerEnter={(e) => {
          if (e.pointerType === "mouse" && !disabled) {
            cancelClose();
            setOpen(true);
          }
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse") scheduleClose();
        }}
        onPointerDown={(e) => {
          clickPointerType.current = e.pointerType;
        }}
        onClick={(e) => {
          const pointerType = clickPointerType.current;
          clickPointerType.current = null;
          if (pointerType === "mouse") {
            e.preventDefault();
            cancelClose();
            setOpen(true);
          }
        }}
        className={cn(
          "flex w-full items-center gap-2 px-3 py-2 text-sm text-left rounded transition-colors cursor-pointer hover:bg-surface-primary-hover focus:bg-surface-primary-hover focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed data-[state=open]:bg-surface-primary-hover text-primary",
          className,
        )}
      >
        {icon && <span className="shrink-0">{icon}</span>}
        <div className="min-w-0 flex-1">
          <p className="font-medium">{label}</p>
          {description && (
            <p className="text-xs text-tertiary">{description}</p>
          )}
        </div>
        <ChevronRightIcon
          className={cn(
            "shrink-0 size-4 text-tertiary transition-transform",
            isNarrow && "rotate-90",
          )}
        />
      </PopoverTrigger>
      <PopoverContent
        side={isNarrow ? "bottom" : "right"}
        align={isNarrow ? "center" : "start"}
        sideOffset={isNarrow ? 4 : 12}
        collisionPadding={8}
        hideArrow
        hideCloseButton
        onOpenAutoFocus={(e) => e.preventDefault()}
        onMouseEnter={cancelClose}
        onMouseLeave={scheduleClose}
        className={cn(
          "w-(--radix-popover-trigger-width) sm:w-64 p-1",
          contentClassName,
        )}
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}

export {
  Popover,
  PopoverTrigger,
  PopoverClose,
  PopoverContent,
  PopoverAnchor,
  PopoverMenuItem,
  PopoverSubMenu,
};
