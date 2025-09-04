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
import { useCallback } from "react";
import { useForm } from "react-hook-form";
import z from "zod";

export type SceneSettingsModalPropTypes = { selectedScene: string };

const formSchema = z.object({
  name: z.string(),
});

const SceneSettingsModal = ({ selectedScene }: SceneSettingsModalPropTypes) => {
  const { isOpen, onToggle, resetData } = useOverlayToggle();

  const data = useData();
  const mainState = usePluginData().mainState!;

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
