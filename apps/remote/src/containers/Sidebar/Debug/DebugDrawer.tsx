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
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
} from "@chakra-ui/react";
import { useAwareness, useData } from "@repo/shared";
import { OverlayToggleComponentProps } from "@repo/ui";
import { lazy } from "react";

const JSONViewer = lazy(() => import("./JSONViewer"));

export type DebugDrawerPropTypes = Omit<
  DrawerProps,
  "isOpen" | "onClose" | "children"
> &
  Partial<OverlayToggleComponentProps> & {};

const DebugDrawer = ({ isOpen, onToggle, ...props }: DebugDrawerPropTypes) => {
  const data = useData();
  const { awarenessData } = useAwareness();

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
          <Tabs isLazy>
            <TabList>
              <Tab>Main Data</Tab>
              <Tab>Awareness Data</Tab>
            </TabList>
            <TabPanels>
              <TabPanel>{<JSONViewer src={data} />}</TabPanel>
              <TabPanel>{<JSONViewer src={awarenessData} />}</TabPanel>
            </TabPanels>
          </Tabs>
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
