import { Sheet, SheetContent, SheetHeader, useOverlayToggle } from "@repo/ui";
import * as React from "react";

export type DrawerShellPropTypes = {
  children: React.ReactNode;
};

export const DrawerShell = ({ children, ...props }: DrawerShellPropTypes) => {
  const { isOpen, onToggle } = useOverlayToggle();

  return (
    <Sheet open={isOpen ?? false} onOpenChange={onToggle} {...props}>
      <SheetContent side="left" className="p-0">
        <SheetHeader></SheetHeader>
        {children}
      </SheetContent>
    </Sheet>
  );
};
