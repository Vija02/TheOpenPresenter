import {
  Button,
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  DrawerProps,
} from "@chakra-ui/react";
import { OverlayToggleComponentProps } from "@repo/ui";
import { lazy } from "react";

import { useData } from "../../../contexts/PluginDataProvider";

const JSONViewer = lazy(() => import("./JSONViewer"));

export type DebugDrawerPropTypes = Omit<
  DrawerProps,
  "isOpen" | "onClose" | "children"
> &
  Partial<OverlayToggleComponentProps> & {};

const DebugDrawer = ({ isOpen, onToggle, ...props }: DebugDrawerPropTypes) => {
  const data = useData();

  return (
    <Drawer
      size="xl"
      isOpen={isOpen ?? false}
      onClose={onToggle ?? (() => {})}
      {...props}
    >
      <DrawerOverlay />
      <DrawerContent>
        <DrawerHeader>Debug</DrawerHeader>
        <DrawerCloseButton />
        <DrawerBody>
          {/* Lazy load */}
          {isOpen && <JSONViewer src={data} />}
        </DrawerBody>

        <DrawerFooter>
          <Button variant="ghost" onClick={onToggle}>
            Close
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};

export default DebugDrawer;
