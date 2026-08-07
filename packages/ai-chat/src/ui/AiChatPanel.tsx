import { Button, LoadingDots } from "@repo/ui";
import { useEffect, useRef, useState } from "react";
import { VscChevronDown, VscChevronRight, VscClose } from "react-icons/vsc";

import { AiMessage, AiMessagePart } from "../store/transcript";
import { AiChat } from "../useAiChat";
import { AttachMenu } from "./AttachMenu";
import { Markdown } from "./Markdown";

export type AiChatProps = {
  ai: AiChat;
};

const Reasoning = ({ text, live }: { text: string; live: boolean }) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="stack-row gap-1 text-2xs text-secondary hover:text-primary text-left w-fit"
      >
        {open ? (
          <VscChevronDown className="shrink-0" />
        ) : (
          <VscChevronRight className="shrink-0" />
        )}
        <span className="italic">
          {live ? "Thinking" : "Thought"}
          {live && (
            <>
              {" "}
              <LoadingDots count={5} label="" />
            </>
          )}
        </span>
      </button>

      {open && (
        <p className="mt-1 ml-4 text-2xs text-tertiary whitespace-pre-wrap border-l border-stroke pl-2">
          {text}
        </p>
      )}
    </div>
  );
};

const Tool = ({ part }: { part: Extract<AiMessagePart, { type: "tool" }> }) => {
  const label =
    part.state === "pending" ? part.name.replace(/_/g, " ") : part.summary;

  return (
    <p
      className={
        part.state === "error"
          ? "stack-row gap-1 text-2xs text-amber-600"
          : "stack-row gap-1 text-2xs text-secondary"
      }
    >
      <span className="shrink-0">
        {part.state === "error" ? "!" : part.state === "pending" ? "›" : "•"}
      </span>
      <span className={part.state === "pending" ? "italic" : undefined}>
        {label}
        {part.state === "pending" && (
          <>
            {" "}
            <LoadingDots count={3} label="" />
          </>
        )}
      </span>
    </p>
  );
};

const AssistantParts = ({
  message,
  streaming,
}: {
  message: AiMessage;
  streaming: boolean;
}) => {
  const parts = message.parts ?? [];
  const tail = parts[parts.length - 1];

  const reasoningIsLive = streaming && tail?.type === "reasoning";
  const toolIsPending =
    streaming && tail?.type === "tool" && tail.state === "pending";

  const showIdleIndicator = streaming && !reasoningIsLive && !toolIsPending;

  return (
    <div className="flex flex-col gap-1">
      {parts.map((part, i) => {
        if (part.type === "reasoning") {
          return (
            <Reasoning
              key={i}
              text={part.text}
              live={reasoningIsLive && i === parts.length - 1}
            />
          );
        }
        if (part.type === "tool") return <Tool key={i} part={part} />;
        return (
          <Markdown
            key={i}
            text={part.text}
            className="text-xs flex flex-col gap-1"
          />
        );
      })}

      {showIdleIndicator && (
        <p className="text-2xs text-secondary italic">
          {/* "Working" once steps have happened */}
          {parts.length === 0 ? "Reading the layout" : "Working"}{" "}
          <LoadingDots count={5} label="" />
        </p>
      )}

      {message.error && (
        <p className="text-2xs text-red-600">{message.error}</p>
      )}
    </div>
  );
};

export const AiChatPanel = ({ ai }: AiChatProps) => {
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const submit = () => {
    if (!draft.trim() || ai.pending) return;
    ai.send(draft);
    setDraft("");
  };

  // Follows the stream
  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [ai.messages, ai.streamingId]);

  return (
    <div className="flex flex-col gap-2">
      {ai.messages.length > 0 && (
        <>
          <div
            ref={scrollRef}
            className="flex flex-col gap-3 max-h-64 overflow-y-auto py-1"
          >
            {ai.messages.map((message) =>
              message.role === "user" ? (
                <div key={message.id} className="flex flex-col gap-1">
                  <p className="text-xs font-medium border-l-2 border-link pl-2 whitespace-pre-wrap">
                    {message.text}
                  </p>
                  {message.image && (
                    <img
                      src={message.image}
                      alt="Reference"
                      className="ml-2 h-10 w-10 object-cover rounded border border-stroke"
                    />
                  )}
                </div>
              ) : (
                <AssistantParts
                  key={message.id}
                  message={message}
                  streaming={ai.streamingId === message.id}
                />
              ),
            )}
          </div>

          <div className="stack-row justify-end">
            <button
              type="button"
              onClick={ai.clear}
              title="Clear conversation"
              className="stack-row gap-1 items-center text-2xs text-secondary hover:text-primary hover:bg-surface-secondary rounded px-1.5 py-0.5 cursor-pointer transition-colors"
            >
              <VscClose className="size-3 shrink-0" />
              Clear conversation
            </button>
          </div>
        </>
      )}

      <div className="flex flex-col rounded border border-stroke bg-surface-primary focus-within:border-link">
        {(ai.image || ai.attaching) && (
          <div className="stack-row gap-2 items-center p-2 pb-0">
            {ai.image ? (
              <div className="relative shrink-0">
                <img
                  src={ai.image}
                  alt="Reference"
                  className="h-12 w-12 object-cover rounded border border-stroke"
                />
                <button
                  type="button"
                  onClick={ai.clearImage}
                  aria-label="Remove reference image"
                  title="Remove reference image"
                  className="absolute -top-1 -right-1 rounded-full bg-surface-primary border border-stroke p-0.5 text-secondary hover:text-primary"
                >
                  <VscClose className="size-3" />
                </button>
              </div>
            ) : (
              <div className="h-12 w-12 shrink-0 rounded border border-stroke stack-row items-center justify-center">
                <LoadingDots count={3} label="" />
              </div>
            )}
            <span className="text-2xs text-secondary">
              {ai.attaching ? "Reading image…" : "Reference attached"}
            </span>
          </div>
        )}

        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={2}
          disabled={ai.pending}
          placeholder={
            ai.messages.length > 0
              ? "Follow up, or ask for something else"
              : "Move the reference to the top and make it smaller"
          }
          className="w-full text-xs bg-transparent p-2 resize-none border-0 outline-none disabled:opacity-60"
        />

        <div className="stack-row justify-between items-center gap-1 px-1.5 pb-1.5">
          <div className="stack-row gap-0.5 items-center">
            <AttachMenu ai={ai} />

            {ai.canUndo && (
              <Button
                variant="ghost"
                size="xs"
                onClick={ai.undo}
                title="Undo the last AI change"
              >
                Undo
              </Button>
            )}
          </div>

          {ai.pending ? (
            <Button variant="outline" size="xs" onClick={ai.stop}>
              Stop
            </Button>
          ) : (
            <Button size="xs" onClick={submit} disabled={!draft.trim()}>
              Send
            </Button>
          )}
        </div>
      </div>

      {ai.error && !ai.streamingId && (
        <p className="text-xs text-red-600">{ai.error}</p>
      )}
    </div>
  );
};
