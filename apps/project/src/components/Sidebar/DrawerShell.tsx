import {
  OverlayToggleComponentProps,
  Sheet,
  SheetContent,
  SheetHeader,
} from "@repo/ui";
import * as React from "react";

export type DrawerShellPropTypes = Partial<OverlayToggleComponentProps> & {
  children: React.ReactNode;
};

export const DrawerShell = ({
  isOpen,
  onToggle,
  resetData,
  children,
  ...props
}: DrawerShellPropTypes) => {
  return (
    <Sheet
      open={isOpen ?? false}
      onOpenChange={(open: boolean) => {
        if (!open && onToggle) {
          onToggle();
        }
      }}
      {...props}
    >
      <SheetContent side="left" className="p-0">
        <SheetHeader></SheetHeader>
        {children}
      </SheetContent>
    </Sheet>
  );
};
