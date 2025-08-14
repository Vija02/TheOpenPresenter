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
  children,
  ...props
}: DrawerShellPropTypes) => {
  return (
    <Sheet open={isOpen ?? false} onOpenChange={onToggle} {...props}>
      <SheetContent side="left" className="p-0">
        <SheetHeader></SheetHeader>
        {children}
      </SheetContent>
    </Sheet>
  );
};
