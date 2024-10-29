import {
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
  DrawerProps,
} from "@chakra-ui/react";
import { OverlayToggleComponentProps } from "@repo/ui";

export type DrawerShellPropTypes = Omit<
  DrawerProps,
  "isOpen" | "onClose" | "children"
> &
  Partial<OverlayToggleComponentProps> & { children: React.ReactNode };

export const DrawerShell = ({
  isOpen,
  onToggle,
  resetData,
  children,
  ...props
}: DrawerShellPropTypes) => {
  return (
    <Drawer
      placement="left"
      isOpen={isOpen ?? false}
      onClose={onToggle ?? (() => {})}
      {...props}
    >
      <DrawerOverlay />
      <DrawerContent>
        <DrawerCloseButton />
        <DrawerHeader></DrawerHeader>

        <DrawerBody padding={0}>{children}</DrawerBody>
      </DrawerContent>
    </Drawer>
  );
};
