import { useAwareness, useData } from "@repo/shared";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  useOverlayToggle,
} from "@repo/ui";
import { lazy } from "react";

const JSONViewer = lazy(() => import("./JSONViewer"));

const DebugDrawer = () => {
  const { isOpen, onToggle } = useOverlayToggle();

  const data = useData();
  const { awarenessData } = useAwareness();

  return (
    <Dialog open={isOpen ?? false} onOpenChange={onToggle ?? (() => {})}>
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
