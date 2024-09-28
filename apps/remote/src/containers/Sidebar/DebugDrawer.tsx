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
import ReactJson from "react-json-view";

import { useData } from "../../contexts/PluginDataProvider";

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
          <ReactJson src={data} />
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
