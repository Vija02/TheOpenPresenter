import { readSseEvents } from "@repo/lib";
import { Button, LoadingDots } from "@repo/ui";
import { useEffect, useRef, useState } from "react";
import { FaWandMagicSparkles } from "react-icons/fa6";

import { usePluginAPI } from "../../pluginApi";

type FormatEvent = {
  delta?: string;
  done?: boolean;
  error?: string;
  type?: string;
  message?: string;
};

export const AiFormatButton = ({
  content,
  onFormatted,
  linesPerSlide,
}: {
  content: string;
  onFormatted: (content: string) => void;
  linesPerSlide?: number;
}) => {
  const pluginApi = usePluginAPI();
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const startedRef = useRef(false);

  // Abort if closed
  useEffect(() => () => abortRef.current?.abort(), []);

  const run = async () => {
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
          body: JSON.stringify({ content, linesPerSlide }),
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
      <Button type="button" size="xs" disabled={isDisabled} onClick={run}>
        <FaWandMagicSparkles />
        {isStreaming ? (
          <>
            Formatting <LoadingDots count={3} label="" />
          </>
        ) : (
          "AI Format"
        )}
      </Button>
      {error && (
        <span className="text-xs text-red-600" title={error}>
          Failed
        </span>
      )}
    </div>
  );
};
