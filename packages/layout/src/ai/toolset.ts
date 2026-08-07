import type { ChatTool } from "@repo/base-types";

import { LayoutDoc } from "../schema/document";
import { buildLayoutAgentMessages } from "./prompt";
import { LAYOUT_TOOLS, applyLayoutTool, isReadOnlyLayoutTool } from "./tools";

const tools: ChatTool[] = LAYOUT_TOOLS.map((tool) => ({
  type: "function" as const,
  function: {
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
    ...(tool.strict ? { strict: true } : {}),
  },
}));

export const layoutAgentToolset = {
  tools,
  buildMessages: buildLayoutAgentMessages,
  apply: (doc: LayoutDoc, name: string, args: unknown) =>
    applyLayoutTool(doc, name, args),
  isReadOnly: isReadOnlyLayoutTool,
  readOnlySummary: "Read the layout.",
};
