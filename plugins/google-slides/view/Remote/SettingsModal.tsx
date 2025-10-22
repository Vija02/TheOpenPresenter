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
  OptionControl,
  useOverlayToggle
} from "@repo/ui";
import { useCallback } from "react";
import { useForm } from "react-hook-form";
import { FaCircleInfo } from "react-icons/fa6";

import { DisplayMode } from "../../src/types";
import { usePluginAPI } from "../pluginApi";
import { calculateBaseSlideIndex } from "../utils/slideIndex";
import { calculateSlideIndexFromAutoplay } from "../utils/useAutoplay";
import { displayTypeMapping } from "./displayTypeMapping";

type SettingsData = {
  displayMode?: DisplayMode;
  autoplayEnabled: boolean;
  autoplayLoopDurationSeconds: number;
};

const SettingsModal = () => {
  const { isOpen, onToggle, resetData } = useOverlayToggle();

  const pluginApi = usePluginAPI();
  const mutableRendererData = pluginApi.renderer.useValtioData();
  const type = pluginApi.scene.useData((x) => x.pluginData.type);
  const displayMode = pluginApi.renderer.useData((x) => x.displayMode);
  const autoplay = pluginApi.renderer.useData((x) => x.autoplay);

  const thumbnailLinks = pluginApi.scene.useData(
    (x) => x.pluginData.thumbnailLinks,
  );

  const handleSubmit = useCallback(
    (rawData: SettingsData) => {
      mutableRendererData.displayMode = rawData.displayMode;

      // If changing to image
      if (
        mutableRendererData.displayMode === "googleslides" &&
        rawData.displayMode === "image"
      ) {
        mutableRendererData.slideIndex = mutableRendererData.resolvedSlideIndex;
      }
      // Handle the reverse
      if (
        mutableRendererData.displayMode === "image" &&
        rawData.displayMode === "googleslides"
      ) {
        mutableRendererData.resolvedSlideIndex =
          (mutableRendererData.slideIndex ?? 0) +
          (mutableRendererData.clickCount ?? 0);
        mutableRendererData.slideIndex =
          (mutableRendererData.slideIndex ?? 0) +
          (mutableRendererData.clickCount ?? 0);

        mutableRendererData.clickCount = 0;
      }

      // If autoplay just turned on, let's update the time
      if (!mutableRendererData.autoplay?.enabled && rawData.autoplayEnabled) {
        mutableRendererData.lastClickTimestamp = Date.now();
      }
      // If autoplay just turned off, update the slide index
      if (mutableRendererData.autoplay?.enabled && !rawData.autoplayEnabled) {
        const newSlideIndex = calculateSlideIndexFromAutoplay({
          lastClickTimestamp: mutableRendererData.lastClickTimestamp,
          loopDurationMs: mutableRendererData.autoplay.loopDurationMs,
          baseIndex: calculateBaseSlideIndex({
            ...mutableRendererData,
            slideCount: thumbnailLinks.length,
          }),
          slideCount: thumbnailLinks.length,
        });
        mutableRendererData.slideIndex = newSlideIndex;
        mutableRendererData.clickCount = 0;
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
    [mutableRendererData, onToggle, resetData, thumbnailLinks.length],
  );

  const form = useForm<SettingsData>({
    values: {
      displayMode: displayMode ?? "googleslides",
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
        <DialogContent size="3xl" asChild>
          <form onSubmit={form.handleSubmit(handleSubmit)}>
            <DialogHeader>
              <DialogTitle>Slides Settings</DialogTitle>
            </DialogHeader>
            <DialogBody>
              <div className="flex flex-col md:flex-row gap-3">
                <div className="stack-col items-start flex-1">
                  <OptionControl
                    control={form.control}
                    label="Display Mode"
                    name="displayMode"
                    options={[
                      {
                        title: "Google Slides",
                        description: (
                          <>
                            Uses the Google Slides embed renderer <br />
                            <div className="mt-2 flex gap-1 italic">
                              <FaCircleInfo className="m-1 shrink-0" />
                              Preserves the most functionality but takes the
                              longest to load
                            </div>
                          </>
                        ),
                        value: "googleslides" satisfies DisplayMode,
                      },
                      {
                        title: "Image",
                        description: (
                          <>
                            Renders the presentation as images <br />
                            <div className="mt-2 flex gap-1 italic">
                              <FaCircleInfo className="m-1 shrink-0" />
                              Doesn't allow animations but is faster to load
                            </div>
                          </>
                        ),
                        value: "image" satisfies DisplayMode,
                      },
                    ].filter((x) =>
                      displayTypeMapping[x.value as DisplayMode].includes(
                        type ?? "googleslides",
                      ),
                    )}
                  />

                  <div>
                    <h3 className="font-bold text-lg">Autoplay</h3>
                    <p>*Only works with Image renderer</p>
                  </div>
                  <div className="w-full flex flex-col gap-3">
                    <CheckboxControl
                      control={form.control}
                      name="autoplayEnabled"
                      label="Enable autoplay"
                      description="Advance slides automatically after the configured interval."
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
                  {/* <FormControl>
                    <FormLabel>Display Mode</FormLabel>
                    <Stack
                      direction={{ base: "column", md: "row" }}
                      alignItems="stretch"
                      marginBottom={2}
                      flexWrap="wrap"
                    >
                      {
                        .map(({ title, description, val }, i) => (
                          <Box
                            key={i}
                            cursor="pointer"
                            border="1px solid"
                            borderColor={
                              values.displayMode === val
                                ? "blue.400"
                                : "gray.200"
                            }
                            rounded="sm"
                            p={2}
                            _hover={{ borderColor: "blue.400" }}
                            onClick={() => {
                              setFieldValue("displayMode", val);
                            }}
                            width="100%"
                            flex={1}
                          >
                            <Text fontWeight="bold" fontSize="md">
                              {title}
                            </Text>
                            <Text fontSize="sm" color="gray.600">
                              {description}
                            </Text>
                          </Box>
                        ))}
                    </Stack>
                  </FormControl> */}
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
          </form>
        </DialogContent>
      </Form>
    </Dialog>
  );
};

export default SettingsModal;
