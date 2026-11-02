import { OVERLAY_LOOK_KEY } from "@repo/base-plugin";
import {
  LayoutDoc,
  createConfidenceOutput,
  createLayoutDoc,
  createProgramBox,
  createSimpleOutputLayout,
  nextOutputId,
  sortedOutputIds,
} from "@repo/layout";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Option,
  useOverlayToggle,
} from "@repo/ui";
import { cx } from "class-variance-authority";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MdPalette } from "react-icons/md";
import { VscAdd } from "react-icons/vsc";

import LayoutEditorModal from "./Layout/LayoutEditorModal";
import LookEditorModal from "./Layout/LookEditorModal";
import LooksModal from "./Looks/LooksModal";
import OutputRow from "./OutputRow";
import { OUTPUT_KINDS, OutputKind, uniqueName } from "./outputKinds";
import { useOutputs } from "./useOutputs";

type Preset = {
  kind: OutputKind;
  title: string;
  description: string;
  name: string;
  layout: () => LayoutDoc;
};

const PRESETS: Preset[] = [
  {
    kind: "confidence",
    title: "Confidence monitor",
    description:
      "Another screen for the stage, eg. one at the front and one at the back",
    name: "Confidence monitor",
    layout: () => createConfidenceOutput().layout,
  },
  {
    kind: "main",
    title: "Mirror",
    description: "Mirrors what the audience sees",
    name: "Mirror",
    layout: () => createSimpleOutputLayout({ followOverlay: false }),
  },
  {
    kind: "overlay",
    title: "Overlay",
    description: OUTPUT_KINDS.overlay.description,
    name: "Overlay",
    layout: () => createSimpleOutputLayout({ look: OVERLAY_LOOK_KEY }),
  },
  {
    kind: "custom",
    title: "Custom layout",
    description: "Start blank and arrange live content, a timer, text and more",
    name: "Custom",
    layout: () =>
      createLayoutDoc({ fitMode: "letterbox", elements: [createProgramBox()] }),
  },
];

const RendererManagementModal = () => {
  const { isOpen, onToggle } = useOverlayToggle();

  const { outputs, writableOutputs } = useOutputs();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [justAddedId, setJustAddedId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [layoutEditorOutputId, setLayoutEditorOutputId] = useState<
    string | null
  >(null);
  const [lookEditor, setLookEditor] = useState<{
    lookKey: string;
    pluginName: string;
  } | null>(null);
  const [showLooks, setShowLooks] = useState(false);
  const [selectedLookKey, setSelectedLookKey] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setShowLooks(false);
    setSelectedLookKey(null);
    setLookEditor(null);
    setLayoutEditorOutputId(null);
    setExpandedId(null);
    setJustAddedId(null);
    setIsAdding(false);
  }, [isOpen]);

  const outputIds = useMemo(() => sortedOutputIds(outputs), [outputs]);

  const addOutput = useCallback(
    (preset: Preset) => {
      const target = writableOutputs();
      const id = nextOutputId(target);
      target[id] = {
        name: uniqueName(
          Object.values(target).map((output) => output.name),
          preset.name,
        ),
        layout: preset.layout(),
      };
      setIsAdding(false);
      setExpandedId(id);
      setJustAddedId(id);
      if (preset.kind === "custom") setLayoutEditorOutputId(id);
    },
    [writableOutputs],
  );

  if (lookEditor) {
    return (
      <LookEditorModal
        isOpen={isOpen ?? false}
        lookKey={lookEditor.lookKey}
        pluginName={lookEditor.pluginName}
        onClose={() => setLookEditor(null)}
      />
    );
  }

  if (showLooks) {
    return (
      <LooksModal
        isOpen={isOpen ?? false}
        outputs={outputs}
        selectedKey={selectedLookKey}
        onSelect={setSelectedLookKey}
        onEditLook={(lookKey, pluginName) =>
          setLookEditor({ lookKey, pluginName })
        }
        onBack={() => setShowLooks(false)}
        onDone={() => onToggle?.()}
      />
    );
  }

  if (layoutEditorOutputId) {
    return (
      <LayoutEditorModal
        isOpen={isOpen ?? false}
        outputId={layoutEditorOutputId}
        onClose={() => setLayoutEditorOutputId(null)}
      />
    );
  }

  return (
    <Dialog open={isOpen ?? false} onOpenChange={onToggle ?? (() => {})}>
      <DialogContent size="3xl">
        <DialogHeader className="px-3 pt-4 sm:px-6 sm:pt-6">
          <DialogTitle>Outputs</DialogTitle>
          <p className="text-sm text-secondary">
            Each output is a type of view you can show on a display
          </p>
        </DialogHeader>
        <DialogBody className="px-3 sm:px-6">
          <div className="flex flex-col gap-3 py-2">
            <ul className="flex flex-col gap-2" aria-label="Outputs">
              {outputIds.map((outputId) => (
                <OutputRow
                  key={outputId}
                  outputId={outputId}
                  output={outputs[outputId]!}
                  isExpanded={expandedId === outputId}
                  onToggle={() =>
                    setExpandedId((current) =>
                      current === outputId ? null : outputId,
                    )
                  }
                  autoFocusName={justAddedId === outputId}
                  onEditLayout={setLayoutEditorOutputId}
                  onManageLooks={(lookKey) => {
                    setSelectedLookKey(lookKey ?? null);
                    setShowLooks(true);
                  }}
                />
              ))}
            </ul>

            {isAdding ? (
              <section
                className="flex flex-col gap-2 rounded-sm border border-dashed border-stroke p-3"
                aria-label="Add an output"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-medium">Add an output</h3>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => setIsAdding(false)}
                  >
                    Cancel
                  </Button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {PRESETS.map((preset) => {
                    const Icon = OUTPUT_KINDS[preset.kind].icon;
                    return (
                      <Option
                        key={preset.title}
                        size="sm"
                        testId={`add-output-${preset.kind}`}
                        onClick={() => addOutput(preset)}
                        className={cx(
                          "bg-surface-primary",
                          preset.kind === "confidence" && "sm:col-span-2",
                        )}
                        icon={<Icon />}
                        title={
                          <span className="flex items-center gap-2">
                            <span>{preset.title}</span>
                            {preset.kind === "confidence" && (
                              <span className="rounded-sm bg-fill-muted px-1.5 py-0.5 text-[10px] font-medium text-fill-muted-fg">
                                Most common
                              </span>
                            )}
                          </span>
                        }
                        description={preset.description}
                      />
                    );
                  })}
                </div>
              </section>
            ) : (
              <Button
                variant="outline"
                className="self-start"
                onClick={() => setIsAdding(true)}
              >
                <VscAdd />
                Add output
              </Button>
            )}
          </div>
        </DialogBody>
        <DialogFooter className="px-3 pb-4 sm:px-6 sm:pb-6">
          <Button
            variant="ghost"
            className="mr-auto"
            onClick={() => setShowLooks(true)}
          >
            <MdPalette />
            Looks
          </Button>
          <Button onClick={onToggle}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RendererManagementModal;
