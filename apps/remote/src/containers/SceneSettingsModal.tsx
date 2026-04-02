import { zodResolver } from "@hookform/resolvers/zod";
import { useData, usePluginData } from "@repo/shared";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Form,
  InputControl,
  useOverlayToggle,
} from "@repo/ui";
import { sortBy } from "lodash-es";
import { useCallback, useMemo } from "react";
import { useForm } from "react-hook-form";
import { VscArrowDown, VscArrowUp } from "react-icons/vsc";
import z from "zod";

export type SceneSettingsModalPropTypes = { selectedScene: string };

const formSchema = z.object({
  name: z.string(),
});

const SceneSettingsModal = ({ selectedScene }: SceneSettingsModalPropTypes) => {
  const { isOpen, onToggle, resetData } = useOverlayToggle();

  const data = useData();
  const mainState = usePluginData().mainState!;

  const sortedSceneIds = useMemo(
    () =>
      sortBy(Object.entries(data.data), ([, value]) => value.order).map(
        ([id]) => id,
      ),
    [data.data],
  );

  const currentIndex = sortedSceneIds.indexOf(selectedScene);

  const handleMoveUp = useCallback(() => {
    if (currentIndex <= 0) return;
    const neighborId = sortedSceneIds[currentIndex - 1]!;
    const currentOrder = mainState.data[selectedScene]!.order;
    const neighborOrder = mainState.data[neighborId]!.order;
    mainState.data[selectedScene]!.order = neighborOrder;
    mainState.data[neighborId]!.order = currentOrder;
  }, [currentIndex, mainState.data, selectedScene, sortedSceneIds]);

  const handleMoveDown = useCallback(() => {
    if (currentIndex >= sortedSceneIds.length - 1) return;
    const neighborId = sortedSceneIds[currentIndex + 1]!;
    const currentOrder = mainState.data[selectedScene]!.order;
    const neighborOrder = mainState.data[neighborId]!.order;
    mainState.data[selectedScene]!.order = neighborOrder;
    mainState.data[neighborId]!.order = currentOrder;
  }, [currentIndex, mainState.data, selectedScene, sortedSceneIds]);

  const handleSubmit = useCallback(
    ({ name }: { name: string }) => {
      mainState.data[selectedScene]!.name = name;

      resetData?.();
      onToggle?.();
      return Promise.resolve();
    },
    [mainState.data, onToggle, resetData, selectedScene],
  );
  const form = useForm({
    resolver: zodResolver(formSchema),
    values: {
      name: data.data[selectedScene]?.name ?? "",
    },
  });

  return (
    <Dialog open={isOpen ?? false} onOpenChange={onToggle ?? (() => {})}>
      <Form {...form}>
        <DialogContent size="sm" asChild>
          <form onSubmit={form.handleSubmit(handleSubmit)}>
            <DialogHeader>
              <DialogTitle>Scene Settings</DialogTitle>
            </DialogHeader>
            <DialogBody>
              <div className="stack-col items-start py-2">
                <InputControl control={form.control} label="Name" name="name" />
                <div className="flex items-center gap-2 w-full">
                  <span className="text-sm font-medium">Reorder</span>
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    onClick={handleMoveUp}
                    disabled={currentIndex <= 0}
                  >
                    <VscArrowUp />
                  </Button>
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    onClick={handleMoveDown}
                    disabled={currentIndex >= sortedSceneIds.length - 1}
                  >
                    <VscArrowDown />
                  </Button>
                </div>
              </div>
            </DialogBody>
            <DialogFooter>
              <Button type="submit">Save</Button>
              <Button variant="outline" onClick={onToggle}>
                Close
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Form>
    </Dialog>
  );
};

export default SceneSettingsModal;
