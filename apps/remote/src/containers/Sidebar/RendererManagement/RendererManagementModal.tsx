import {
  BUILT_IN_LOOK_KEYS,
  CONFIDENCE_LOOK_KEY,
  MAIN_LOOK_KEY,
} from "@repo/base-plugin";
import {
  LayoutDoc,
  MAIN_OUTPUT_ID,
  builtInPluginLook,
  createLayoutDoc,
  createProgramBox,
  createSimpleOutputLayout,
  nextOutputId,
  sortedOutputIds,
} from "@repo/layout";
import { useData } from "@repo/shared";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  useOverlayToggle,
} from "@repo/ui";
import { useCallback, useMemo, useState } from "react";
import { VscAdd, VscEdit } from "react-icons/vsc";

import LayoutEditorModal from "./Layout/LayoutEditorModal";
import LookEditorModal from "./Layout/LookEditorModal";
import { useRegisteredPluginMeta } from "./Layout/useRegisteredPluginMeta";
import OutputCard from "./OutputCard";
import { useOutputs } from "./useOutputs";

const SHORTCUT_LOOKS = BUILT_IN_LOOK_KEYS.filter(
  (look) => look.key !== MAIN_LOOK_KEY,
);

const RendererManagementModal = () => {
  const { isOpen, onToggle } = useOverlayToggle();

  const data = useData();
  const { outputs, writableOutputs } = useOutputs();
  const { titleByPlugin, looks } = useRegisteredPluginMeta();

  const [layoutEditorOutputId, setLayoutEditorOutputId] = useState<
    string | null
  >(null);
  const [lookEditor, setLookEditor] = useState<{
    lookKey: string;
    pluginName: string;
  } | null>(null);

  const outputIds = useMemo(() => sortedOutputIds(outputs), [outputs]);

  const addOutput = useCallback(
    (name: string, layout: LayoutDoc) => {
      const target = writableOutputs();
      const id = nextOutputId(target);
      target[id] = { name, layout };
      return id;
    },
    [writableOutputs],
  );

  const addLookOutput = useCallback(
    (key: string, name: string) =>
      addOutput(
        name,
        createSimpleOutputLayout({
          look: key,
          // A confidence monitor keeps showing when the room goes black
          followOverlay: key !== CONFIDENCE_LOOK_KEY,
        }),
      ),
    [addOutput],
  );

  const addCustomOutput = useCallback(() => {
    const id = addOutput(
      "Custom",
      createLayoutDoc({ fitMode: "letterbox", elements: [createProgramBox()] }),
    );
    setLayoutEditorOutputId(id);
  }, [addOutput]);

  const handleDeleteOutput = useCallback(
    (outputId: string) => {
      if (outputId === MAIN_OUTPUT_ID) return;
      delete writableOutputs()[outputId];
    },
    [writableOutputs],
  );

  const pluginsByLook = useMemo(
    () =>
      SHORTCUT_LOOKS.map((look) => {
        const pluginNames = new Set<string>();
        for (const pluginName of titleByPlugin.keys()) {
          if (
            builtInPluginLook(looks, pluginName, look.key) ||
            data.looks?.[look.key]?.plugins?.[pluginName]
          ) {
            pluginNames.add(pluginName);
          }
        }
        const others = [...titleByPlugin.keys()].filter(
          (name) => !pluginNames.has(name),
        );
        return { look, pluginNames: [...pluginNames], others };
      }),
    [titleByPlugin, looks, data.looks],
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
        <DialogHeader>
          <DialogTitle>Outputs</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="flex flex-col gap-6 py-2">
            <section className="flex flex-col gap-3">
              <p className="text-sm text-secondary">
                Each output is a display. It shows what is live in a look, or a
                custom layout.
              </p>

              <div className="flex flex-wrap gap-4">
                {outputIds.map((outputId) => (
                  <OutputCard
                    key={outputId}
                    outputId={outputId}
                    output={outputs[outputId]!}
                    onDelete={handleDeleteOutput}
                    onOpenLayoutEditor={setLayoutEditorOutputId}
                  />
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                {SHORTCUT_LOOKS.map((look) => (
                  <Button
                    key={look.key}
                    variant="outline"
                    size="sm"
                    onClick={() => addLookOutput(look.key, look.name)}
                  >
                    <VscAdd /> Add {look.name.toLowerCase()}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addLookOutput(MAIN_LOOK_KEY, "Main copy")}
                >
                  <VscAdd /> Add copy of main
                </Button>
                <Button variant="outline" size="sm" onClick={addCustomOutput}>
                  <VscAdd /> Add custom layout
                </Button>
              </div>
            </section>

            <section className="flex flex-col gap-3">
              <div>
                <h3 className="font-medium">Looks</h3>
                <p className="text-sm text-secondary">
                  How each kind of content shows in a look, in this project.
                </p>
              </div>
              {pluginsByLook.map(({ look, pluginNames, others }) => (
                <div
                  key={look.key}
                  className="flex flex-wrap items-center gap-2 text-sm"
                >
                  <span className="w-40 shrink-0 text-secondary">
                    {look.name}
                  </span>
                  {pluginNames.map((pluginName) => (
                    <Button
                      key={pluginName}
                      variant="outline"
                      size="xs"
                      onClick={() =>
                        setLookEditor({ lookKey: look.key, pluginName })
                      }
                    >
                      <VscEdit />
                      {titleByPlugin.get(pluginName) ?? pluginName}
                    </Button>
                  ))}
                  {others.length > 0 && (
                    <select
                      aria-label={`Customize ${look.name.toLowerCase()} for another plugin`}
                      className="border border-stroke rounded-sm px-2 py-0.5 bg-surface-primary text-xs"
                      value=""
                      onChange={(e) =>
                        e.target.value &&
                        setLookEditor({
                          lookKey: look.key,
                          pluginName: e.target.value,
                        })
                      }
                    >
                      <option value="">Another…</option>
                      {others.map((pluginName) => (
                        <option key={pluginName} value={pluginName}>
                          {titleByPlugin.get(pluginName) ?? pluginName}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              ))}
            </section>
          </div>
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

export default RendererManagementModal;
