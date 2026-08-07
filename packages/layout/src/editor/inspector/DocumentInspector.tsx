import { AiChat, AiChatPanel } from "@repo/ai-chat";
import { ReactNode } from "react";

import { LayoutDoc } from "../../schema/document";
import { Section } from "./primitives";

export type DocumentInspectorProps = {
  doc: LayoutDoc;
  onChange: (doc: LayoutDoc) => void;
  /** Extra controls*/
  children?: ReactNode;
  hint?: string;
  /** Omit to hide the AI panel entirely. */
  ai?: AiChat;
};

export const DocumentInspector = ({
  children,
  hint = "Click an element on the canvas to edit it. Drag to move, drag a corner to resize, arrow keys to nudge.",
  ai,
}: DocumentInspectorProps) => (
  <>
    <p className="text-xs text-secondary py-2">{hint}</p>

    {ai && (
      <Section title="Ask AI">
        <AiChatPanel ai={ai} />
      </Section>
    )}

    {children && <Section title="Slide">{children}</Section>}
  </>
);
