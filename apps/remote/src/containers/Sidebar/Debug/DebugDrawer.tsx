import { useAwareness, useData } from "@repo/shared";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  OverlayToggleComponentProps,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@repo/ui";
import { lazy } from "react";

const JSONViewer = lazy(() => import("./JSONViewer"));

export type DebugDrawerPropTypes = Partial<OverlayToggleComponentProps>;

const DebugDrawer = ({ isOpen, onToggle, ...props }: DebugDrawerPropTypes) => {
  const data = useData();
  const { awarenessData } = useAwareness();

  return (
    <Dialog
      open={isOpen ?? false}
      onOpenChange={onToggle ?? (() => {})}
      {...props}
    >
      <DialogContent size="2xl">
        <DialogHeader>
          <DialogTitle>Debug</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <Tabs defaultValue="main">
            <TabsList>
              <TabsTrigger value="main">Main Data</TabsTrigger>
              <TabsTrigger value="awareness">Awareness Data</TabsTrigger>
            </TabsList>
            <TabsContent value="main">{<JSONViewer src={data} />}</TabsContent>
            <TabsContent value="awareness">
              {<JSONViewer src={awarenessData} />}
            </TabsContent>
          </Tabs>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={onToggle}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DebugDrawer;
