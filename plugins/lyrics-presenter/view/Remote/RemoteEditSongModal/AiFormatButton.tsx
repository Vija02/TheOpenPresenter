import { Button } from "@repo/ui";
import { useRef, useState } from "react";
import { FaWandMagicSparkles } from "react-icons/fa6";

import { usePluginAPI } from "../../pluginApi";

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

  const run = async () => {
    if (isStreaming) return;
    setError(null);
    setIsStreaming(true);
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

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let acc = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let sep: number;
        while ((sep = buffer.indexOf("\n\n")) !== -1) {
          const frame = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          const dataLine = frame.split("\n").find((l) => l.startsWith("data:"));
          if (!dataLine) continue;

          let payload: { delta?: string; done?: boolean; error?: string };
          try {
            payload = JSON.parse(dataLine.slice(5).trim());
          } catch {
            continue;
          }
          if (payload.error) throw new Error(payload.error);
          if (payload.done) continue;
          if (payload.delta) {
            acc += payload.delta;
            onFormatted(acc); // live update as tokens arrive
          }
        }
      }
      onFormatted(acc.trim()); // final, trimmed result
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setError((e as Error).message || "AI formatting failed");
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  };

  const isDisabled = isStreaming || content.trim().length === 0;

  return (
    <div className="stack-row gap-1">
      <Button type="button" size="xs" disabled={isDisabled} onClick={run}>
        <FaWandMagicSparkles
          className={isStreaming ? "animate-pulse" : undefined}
        />
        {isStreaming ? "Formatting..." : "AI Format"}
      </Button>
      {error && (
        <span className="text-xs text-red-600" title={error}>
          Failed
        </span>
      )}
    </div>
  );
};
