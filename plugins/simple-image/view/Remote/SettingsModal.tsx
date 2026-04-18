import {
  Button,
  CheckboxControl,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Form,
  NumberInputControl,
  useOverlayToggle,
} from "@repo/ui";
import { useCallback } from "react";
import { useForm } from "react-hook-form";

import { usePluginAPI } from "../pluginApi";
import { calculateSlideIndexFromAutoplay } from "../utils/useAutoplay";

type SettingsData = {
  autoplayEnabled: boolean;
  autoplayLoopDurationSeconds: number;
};

export const SettingsModal = () => {
  const { isOpen, onToggle, resetData } = useOverlayToggle();

  const pluginApi = usePluginAPI();
  const mutableRendererData = pluginApi.renderer.useValtioData();
  const autoplay = pluginApi.renderer.useData((x) => x.autoplay);
  const images = pluginApi.scene.useData((x) => x.pluginData.images);

  const handleSubmit = useCallback(
    (rawData: SettingsData) => {
      // If autoplay just turned on, let's update the time
      if (!mutableRendererData.autoplay?.enabled && rawData.autoplayEnabled) {
        mutableRendererData.lastClickTimestamp = Date.now();
      }
      // If autoplay just turned off, update the slide index
      if (mutableRendererData.autoplay?.enabled && !rawData.autoplayEnabled) {
        const newSlideIndex = calculateSlideIndexFromAutoplay({
          lastClickTimestamp: mutableRendererData.lastClickTimestamp,
          loopDurationMs: mutableRendererData.autoplay.loopDurationMs,
          baseIndex: mutableRendererData.imgIndex ?? 0,
          slideCount: images.length,
        });
        mutableRendererData.imgIndex = newSlideIndex;
      }
      if (!mutableRendererData.autoplay) {
        mutableRendererData.autoplay = {
          enabled: rawData.autoplayEnabled,
          loopDurationMs: rawData.autoplayLoopDurationSeconds * 1000,
        };
      } else {
        mutableRendererData.autoplay.enabled = rawData.autoplayEnabled;
        mutableRendererData.autoplay.loopDurationMs =
          rawData.autoplayLoopDurationSeconds * 1000;
      }

      resetData?.();
      onToggle?.();
      return Promise.resolve();
    },
    [mutableRendererData, onToggle, resetData, images.length],
  );

  const form = useForm<SettingsData>({
    values: {
      autoplayEnabled: autoplay?.enabled ?? false,
      autoplayLoopDurationSeconds: Math.max(
        1,
        Math.round((autoplay?.loopDurationMs ?? 10000) / 1000),
      ),
    },
  });

  const autoplayEnabled = form.watch("autoplayEnabled");

  return (
    <Dialog open={isOpen ?? false} onOpenChange={onToggle ?? (() => {})}>
      <Form {...form}>
        <DialogContent
          size="xl"
          render={<form onSubmit={form.handleSubmit(handleSubmit)} />}
        >
          <DialogHeader>
            <DialogTitle>Image Settings</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <div className="flex flex-col gap-3">
              <div className="stack-col items-start flex-1">
                <div>
                  <h3 className="font-bold text-lg">Autoplay</h3>
                </div>
                <div className="w-full flex flex-col gap-3">
                  <CheckboxControl
                    control={form.control}
                    name="autoplayEnabled"
                    label="Enable autoplay"
                    description="Advance images automatically after the configured interval."
                  />
                  <NumberInputControl
                    control={form.control}
                    name="autoplayLoopDurationSeconds"
                    label="Autoplay interval"
                    unit="s"
                    min={0.1}
                    max={600}
                    step={1}
                    disabled={!autoplayEnabled}
                    className="max-w-40"
                  />
                </div>
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="submit" variant="success">
              Save
            </Button>
            <Button variant="outline" onClick={onToggle}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Form>
    </Dialog>
  );
};
