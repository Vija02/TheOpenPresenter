import { Button } from "@repo/ui";
import { LuEraser, LuHighlighter, LuPencil, LuWand } from "react-icons/lu";

import type { InkTool } from "../../../../src/ink";
import { usePluginAPI } from "../../../pluginApi";

const TOOLS: { tool: InkTool; label: string; icon: React.ReactNode }[] = [
  { tool: "laser", label: "Laser", icon: <LuWand /> },
  { tool: "pencil", label: "Pencil", icon: <LuPencil /> },
  { tool: "highlight", label: "Highlight", icon: <LuHighlighter /> },
];

/** Pick a tool to draw on the slide with; pick it again to put it down */
export const InkToolbar = ({
  tool,
  onToolChange,
  slideRef,
}: {
  tool: InkTool | null;
  onToolChange: (tool: InkTool | null) => void;
  slideRef: string | null;
}) => {
  const pluginApi = usePluginAPI();
  const mutableRendererData = pluginApi.renderer.useValtioData();
  // Selectors are path lookups only: the watcher records the path they read
  const marks = pluginApi.renderer.useData((x) => x.ink?.[slideRef ?? ""]);
  const hasMarks = (marks?.length ?? 0) > 0;

  return (
    <div className="flex items-center gap-1" role="toolbar" aria-label="Draw">
      {TOOLS.map(({ tool: option, label, icon }) => (
        <Button
          key={option}
          variant={tool === option ? "default" : "ghost"}
          size="sm"
          title={label}
          aria-label={label}
          aria-pressed={tool === option}
          onClick={() => onToolChange(tool === option ? null : option)}
        >
          {icon}
        </Button>
      ))}
      <Button
        variant="ghost"
        size="sm"
        title="Clear marks on this slide"
        aria-label="Clear marks on this slide"
        disabled={!hasMarks}
        onClick={() => {
          if (slideRef && mutableRendererData.ink?.[slideRef]) {
            delete mutableRendererData.ink[slideRef];
          }
        }}
      >
        <LuEraser />
      </Button>
    </div>
  );
};
