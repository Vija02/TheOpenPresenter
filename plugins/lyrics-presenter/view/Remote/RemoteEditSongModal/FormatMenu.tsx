import { appData, readSseEvents } from "@repo/lib";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  LoadingDots,
  Popover,
  PopoverContent,
  PopoverMenuItem,
  PopoverTrigger,
  Textarea,
} from "@repo/ui";
import { useEffect, useRef, useState } from "react";
import { FaWandMagicSparkles } from "react-icons/fa6";
import { VscChevronDown, VscListFlat, VscSparkle } from "react-icons/vsc";

import { splitIntoSlides } from "../../../src/format/splitIntoSlides";
import { usePluginAPI } from "../../pluginApi";

type FormatEvent = {
  delta?: string;
  done?: boolean;
  error?: string;
  type?: string;
  message?: string;
};

const AI_ENABLED = appData.getAiEnabled();

/**
 * Auto format song as slides.
 * Whether 2, 4, or AI
 */
export const FormatMenu = ({
  content,
  onFormatted,
}: {
  content: string;
  onFormatted: (content: string) => void;
}) => {
  const pluginApi = usePluginAPI();
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [askingInstructions, setAskingInstructions] = useState(false);
  const [instructions, setInstructions] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const startedRef = useRef(false);

  // Abort if closed
  useEffect(() => () => abortRef.current?.abort(), []);

  const split = (linesPerSlide: number) => {
    setError(null);
    onFormatted(splitIntoSlides(content, linesPerSlide));
  };

  const formatWithAi = async (userInstructions?: string) => {
    if (isStreaming) return;
    setError(null);
    setIsStreaming(true);
    startedRef.current = false;
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(
        window.location.origin + "/plugin/lyrics-presenter/ai/format",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "csrf-token": pluginApi.env.getCSRFToken(),
            ...pluginApi.env.getProxyConfig().headers,
          },
          body: JSON.stringify({
            content,
            instructions: userInstructions,
            organizationId: pluginApi.pluginContext.organizationId,
          }),
          signal: controller.signal,
        },
      );
      if (!res.ok || !res.body) {
        throw new Error(`Request failed (${res.status})`);
      }

      let acc = "";

      for await (const event of readSseEvents(res.body, {
        signal: controller.signal,
      })) {
        let payload: FormatEvent;
        try {
          payload = JSON.parse(event.data);
        } catch {
          continue;
        }
        if (payload.type === "fatal") {
          throw new Error(payload.message || "AI formatting failed");
        }
        if (payload.error) throw new Error(payload.error);
        if (payload.done) continue;
        if (payload.delta) {
          acc += payload.delta;
          startedRef.current = true;
          onFormatted(acc); // live update as tokens arrive
        }
      }
      onFormatted(acc.trim()); // final, trimmed result
    } catch (e) {
      if (startedRef.current) onFormatted(content);
      if ((e as Error).name !== "AbortError") {
        setError((e as Error).message || "AI formatting failed");
      }
    } finally {
      startedRef.current = false;
      setIsStreaming(false);
      abortRef.current = null;
    }
  };

  const isDisabled = isStreaming || content?.trim().length === 0;

  return (
    <div className="stack-row gap-1">
      <div className="stack-row gap-0">
        {AI_ENABLED && (
          <Button
            type="button"
            size="xs"
            className="rounded-r-none"
            disabled={isDisabled}
            onClick={() => void formatWithAi()}
          >
            <FaWandMagicSparkles />
            {isStreaming ? (
              <>
                Formatting <LoadingDots count={3} label="" />
              </>
            ) : (
              "AI Format"
            )}
          </Button>
        )}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              size="xs"
              className={
                AI_ENABLED ? "rounded-l-none border-l border-l-black/20" : ""
              }
              disabled={isDisabled}
              aria-label={AI_ENABLED ? "More ways to format" : undefined}
            >
              {!AI_ENABLED && (
                <>
                  <VscListFlat />
                  Format
                </>
              )}
              <VscChevronDown />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            hideArrow
            hideCloseButton
            className="w-60 p-1"
          >
            <PopoverMenuItem
              label="2 lines per slide"
              icon={<VscListFlat />}
              onClick={() => split(2)}
            />
            <PopoverMenuItem
              label="4 lines per slide"
              icon={<VscListFlat />}
              onClick={() => split(4)}
            />
            {AI_ENABLED && (
              <PopoverMenuItem
                label="Custom AI…"
                description="Tell the AI what you want"
                icon={<VscSparkle />}
                onClick={() => setAskingInstructions(true)}
              />
            )}
          </PopoverContent>
        </Popover>
      </div>
      {error && (
        <span className="text-xs text-red-600" title={error}>
          Failed
        </span>
      )}

      <Dialog open={askingInstructions} onOpenChange={setAskingInstructions}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Format with AI</DialogTitle>
            <DialogDescription>
              Say how you want the song laid out.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <Textarea
              value={instructions}
              autoFocus
              rows={4}
              maxLength={1000}
              placeholder="e.g. 3 lines per slide, and repeat the chorus after every verse"
              onChange={(event) => setInstructions(event.target.value)}
            />
          </DialogBody>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAskingInstructions(false)}
            >
              Cancel
            </Button>
            <Button
              disabled={!instructions.trim()}
              onClick={() => {
                setAskingInstructions(false);
                void formatWithAi(instructions.trim());
              }}
            >
              Format
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
