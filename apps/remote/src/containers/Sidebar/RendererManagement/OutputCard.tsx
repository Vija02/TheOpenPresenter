import { BUILT_IN_LOOK_KEYS, MAIN_LOOK_KEY } from "@repo/base-plugin";
import {
  MAIN_OUTPUT_ID,
  Output,
  cloneDoc,
  setHostFollowOverlay,
  setHostLook,
  simpleOutputInfo,
} from "@repo/layout";
import { usePluginMetaData } from "@repo/shared";
import { Button, Checkbox, PopConfirm } from "@repo/ui";
import { useCallback } from "react";
import { VscLinkExternal, VscSettings, VscTrash } from "react-icons/vsc";
import { useSearch } from "wouter";

import { useOutputs } from "./useOutputs";

type OutputCardProps = {
  outputId: string;
  output: Output;
  onDelete: (outputId: string) => void;
  onOpenLayoutEditor: (outputId: string) => void;
};

const selectClassName =
  "border border-stroke rounded-sm px-2 py-1 bg-surface-primary min-w-0";

const OutputCard = ({
  outputId,
  output,
  onDelete,
  onOpenLayoutEditor,
}: OutputCardProps) => {
  const { orgSlug, projectSlug } = usePluginMetaData();
  const search = useSearch();
  const { writableOutputs } = useOutputs();

  // A simple output is edited here, without the layout editor
  const simple = simpleOutputInfo(output.layout);
  const boxId = output.layout.elements[0]?.id ?? "";

  const editLayout = useCallback(
    (edit: (layout: Output["layout"]) => Output["layout"]) => {
      const target = writableOutputs()[outputId];
      if (!target) return;
      target.layout = cloneDoc(edit(cloneDoc(output.layout)));
    },
    [writableOutputs, outputId, output.layout],
  );

  const rename = useCallback(
    (name: string) => {
      const target = writableOutputs()[outputId];
      if (target) target.name = name;
    },
    [writableOutputs, outputId],
  );

  const params = new URLSearchParams(search);
  params.set("renderer", outputId);
  const openHref = `/render/${orgSlug}/${projectSlug}?${params.toString()}`;

  return (
    <div className="border rounded p-4 flex flex-col gap-3 flex-1 min-w-[280px]">
      <div className="flex items-center justify-between gap-2">
        <input
          aria-label={`Name of output ${outputId}`}
          className="font-medium text-base bg-transparent border-b border-transparent hover:border-stroke focus:border-stroke outline-none min-w-0 flex-1"
          value={output.name}
          onChange={(e) => rename(e.target.value)}
        />
        <div className="flex items-center gap-1 shrink-0">
          <Button asChild size="icon" variant="ghost" className="h-7 w-7">
            <a
              href={openHref}
              target="_blank"
              rel="noreferrer"
              title="Open in a new tab"
            >
              <VscLinkExternal className="w-3.5 h-3.5" />
            </a>
          </Button>
          {outputId !== MAIN_OUTPUT_ID && (
            <PopConfirm
              title="Delete output"
              description={`Are you sure you want to delete ${output.name}?`}
              onConfirm={() => onDelete(outputId)}
            >
              <Button
                size="icon"
                variant="ghost"
                className="text-red-600 hover:text-red-700 hover:bg-red-50 h-7 w-7"
                aria-label={`Delete ${output.name}`}
              >
                <VscTrash className="w-3.5 h-3.5" />
              </Button>
            </PopConfirm>
          )}
        </div>
      </div>

      {simple ? (
        <div className="flex flex-col gap-2 text-sm">
          <label className="flex items-center justify-between gap-2">
            <span className="text-secondary">Look</span>
            <select
              className={selectClassName}
              value={simple.look}
              onChange={(e) =>
                editLayout((layout) =>
                  setHostLook(
                    layout,
                    boxId,
                    e.target.value === MAIN_LOOK_KEY ? null : e.target.value,
                  ),
                )
              }
            >
              {BUILT_IN_LOOK_KEYS.map((look) => (
                <option key={look.key} value={look.key}>
                  {look.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={simple.followOverlay}
              onCheckedChange={(checked) =>
                editLayout((layout) =>
                  setHostFollowOverlay(layout, boxId, checked === true),
                )
              }
            />
            Follow Black/Clear
          </label>
        </div>
      ) : (
        <p className="text-sm text-secondary">Custom layout</p>
      )}

      <div className="flex justify-end">
        <Button
          size="xs"
          variant="outline"
          onClick={() => onOpenLayoutEditor(outputId)}
        >
          <VscSettings className="mr-1" />
          Configure
        </Button>
      </div>
    </div>
  );
};

export default OutputCard;
