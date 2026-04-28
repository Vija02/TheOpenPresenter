import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
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
  OverlayToggle,
  PopConfirm,
  useOverlayToggle,
} from "@repo/ui";
import { useCallback, useMemo } from "react";
import { useForm } from "react-hook-form";
import { FaFilePdf } from "react-icons/fa";
import { FaArrowsRotate, FaCircleInfo, FaTrash } from "react-icons/fa6";
import { RiFilePpt2Fill } from "react-icons/ri";
import { SiGoogleslides } from "react-icons/si";

import {
  DisplayMode,
  ImportType,
  getEffectiveDisplayMode,
} from "../../src/types";
import { usePluginAPI } from "../pluginApi";
import { trpc } from "../trpc";
import {
  calculateAutoplayPosition,
  computeGlobalSlideClickCount,
} from "../utils/useAutoplay";
import ImportFileModal from "./ImportFile/ImportFileModal";
import { displayTypeMapping } from "./displayTypeMapping";

const IMPORT_TYPE_ICON: Record<ImportType, React.ReactNode> = {
  googleslides: <SiGoogleslides className="size-5 shrink-0 text-[#F4B400]" />,
  pdf: <FaFilePdf className="size-5 shrink-0 text-[#F52102]" />,
  ppt: <RiFilePpt2Fill className="size-5 shrink-0 text-[#CC4A34]" />,
};

type SettingsData = {
  displayModes: Record<string, DisplayMode>;
  autoplayEnabled: boolean;
  autoplayLoopDurationSeconds: number;
};

const SettingsModal = () => {
  const { isOpen, onToggle, resetData } = useOverlayToggle();

  const pluginApi = usePluginAPI();
  const mutableRendererData = pluginApi.renderer.useValtioData();

  const { mutate: removeImport } = trpc.googleslides.removeImport.useMutation();

  const pluginData = pluginApi.scene.useData((x) => x.pluginData);
  const autoplay = pluginApi.renderer.useData((x) => x.autoplay);
  const rendererDisplayModes = pluginApi.renderer.useData(
    (x) => x.displayModes,
  );

  const importsList = useMemo(
    () => Object.values(pluginData.imports ?? {}),
    [pluginData.imports],
  );

  const currentDisplayModes = useMemo(
    () =>
      Object.fromEntries(
        importsList.map((imp) => [
          imp.importId,
          getEffectiveDisplayMode(imp, rendererDisplayModes),
        ]),
      ) as Record<string, DisplayMode>,
    [importsList, rendererDisplayModes],
  );

  const handleSubmit = useCallback(
    (rawData: SettingsData) => {
      // Apply per-import display mode changes
      let anyDisplayModeChanged = false;
      for (const imp of importsList) {
        const newMode = rawData.displayModes?.[imp.importId];
        const oldMode = currentDisplayModes[imp.importId];
        if (newMode && newMode !== oldMode) {
          if (!mutableRendererData.displayModes) {
            mutableRendererData.displayModes = {};
          }
          mutableRendererData.displayModes[imp.importId] = newMode;
          anyDisplayModeChanged = true;
        }
      }

      // When switching display modes, reset click count
      if (anyDisplayModeChanged) {
        mutableRendererData.currentClickCount = 0;
      }

      // If autoplay just turned on, let's update the time
      if (!mutableRendererData.autoplay?.enabled && rawData.autoplayEnabled) {
        mutableRendererData.lastClickTimestamp = Date.now();
      }
      // If autoplay just turned off, freeze at the current autoplay position
      if (mutableRendererData.autoplay?.enabled && !rawData.autoplayEnabled) {
        const newPos = calculateAutoplayPosition({
          lastClickTimestamp: mutableRendererData.lastClickTimestamp,
          loopDurationMs: mutableRendererData.autoplay.loopDurationMs,
          baseIndex: mutableRendererData.currentSlideIndex ?? 0,
          baseClickCount: mutableRendererData.currentClickCount ?? 0,
          globalSlideClickCount: computeGlobalSlideClickCount(
            pluginData,
            mutableRendererData.displayModes,
          ),
        });
        mutableRendererData.currentSlideIndex = newPos.slideIndex;
        mutableRendererData.currentClickCount = newPos.clickCount;
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
    [
      currentDisplayModes,
      importsList,
      mutableRendererData,
      onToggle,
      pluginData,
      resetData,
    ],
  );

  const form = useForm<SettingsData>({
    values: {
      displayModes: currentDisplayModes,
      autoplayEnabled: autoplay?.enabled ?? false,
      autoplayLoopDurationSeconds: Math.max(
        1,
        Math.round((autoplay?.loopDurationMs ?? 10000) / 1000),
      ),
    },
  });

  const autoplayEnabled = form.watch("autoplayEnabled");

  const handleDeleteImport = useCallback(
    (importId: string) => {
      removeImport({
        pluginId: pluginApi.pluginContext.pluginId,
        importId,
      });
    },
    [removeImport, pluginApi.pluginContext.pluginId],
  );

  return (
    <Dialog open={isOpen ?? false} onOpenChange={onToggle ?? (() => {})}>
      <Form {...form}>
        <DialogContent
          size="3xl"
          render={<form onSubmit={form.handleSubmit(handleSubmit)} />}
        >
          <DialogHeader>
            <DialogTitle>Slides Settings</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <div className="flex flex-col gap-4">
              <div>
                <h3 className="font-bold text-lg mb-2">Autoplay</h3>
                <div className="w-full flex flex-col gap-3">
                  <CheckboxControl
                    control={form.control}
                    name="autoplayEnabled"
                    label="Enable autoplay"
                    description="Advance slides automatically after the configured interval."
                  />
                  {autoplayEnabled && (
                    <NumberInputControl
                      control={form.control}
                      name="autoplayLoopDurationSeconds"
                      label="Autoplay interval"
                      unit="s"
                      min={0.1}
                      max={600}
                      step={1}
                      className="max-w-40"
                    />
                  )}
                </div>
              </div>

              {importsList.length > 0 && (
                <div>
                  <h3 className="font-bold text-lg mb-2">Imports</h3>
                  <div className="flex flex-col gap-3">
                    {importsList.map((imp, idx) => {
                      const displayTitle = imp.name ?? `Import ${idx + 1}`;
                      const filteredOptions = [
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
                          imp.type,
                        ),
                      );
                      return (
                        <div
                          key={imp.importId}
                          className="flex flex-col gap-2 border border-gray-200 rounded p-3"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              {IMPORT_TYPE_ICON[imp.type]}
                              <h4
                                className="font-medium truncate"
                                title={displayTitle}
                              >
                                {displayTitle}
                              </h4>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <OverlayToggle
                                toggler={({ onToggle }) => (
                                  <Button
                                    type="button"
                                    size="xs"
                                    variant="outline"
                                    onClick={onToggle}
                                  >
                                    <FaArrowsRotate />
                                    Replace
                                  </Button>
                                )}
                              >
                                <ImportFileModal
                                  replaceImportId={imp.importId}
                                />
                              </OverlayToggle>
                              <PopConfirm
                                title="Delete this import?"
                                description={`"${displayTitle}" and all of its slides will be removed.`}
                                okText="Delete"
                                onConfirm={() =>
                                  handleDeleteImport(imp.importId)
                                }
                              >
                                <Button
                                  type="button"
                                  size="xs"
                                  variant="outline"
                                >
                                  <FaTrash />
                                  Delete
                                </Button>
                              </PopConfirm>
                            </div>
                          </div>
                          {filteredOptions.length > 1 && (
                            <Accordion type="single" collapsible>
                              <AccordionItem
                                value="advanced"
                                className="border-0"
                              >
                                <AccordionTrigger className="py-1 text-sm">
                                  Advanced
                                </AccordionTrigger>
                                <AccordionContent className="pt-2">
                                  <OptionControl
                                    control={form.control}
                                    label="Display Mode"
                                    name={
                                      `displayModes.${imp.importId}` as `displayModes.${string}`
                                    }
                                    options={filteredOptions}
                                  />
                                </AccordionContent>
                              </AccordionItem>
                            </Accordion>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
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

export default SettingsModal;
