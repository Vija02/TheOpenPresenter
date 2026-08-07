import type { AiTurn, MediaPicker, PluginContext } from "@repo/base-types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { resolvePickedImage } from "./image/mediaSource";
import {
  fileToReferenceImage,
  urlToReferenceImage,
} from "./image/referenceImage";
import type { AiChatPickedImage } from "./image/types";
import {
  AiMessage,
  toPromptHistory,
  useTranscriptStore,
} from "./store/transcript";

export type AiChatStep<TDoc> =
  | { type: "thinkingDelta"; text: string }
  | { type: "messageDelta"; text: string }
  | { type: "toolPending"; name: string }
  | { type: "tool"; name: string; summary: string; doc?: TDoc }
  | { type: "toolError"; name: string; message: string }
  | { type: "message"; text: string }
  | { type: "done"; doc: TDoc; changed: boolean }
  | { type: "fatal"; message: string };

export type AiChatRequest<TDoc> = (args: {
  request: string;
  doc: TDoc;
  history: AiTurn[];
  image?: string | null;
  signal: AbortSignal;
  onStep: (step: AiChatStep<TDoc>) => void;
}) => Promise<void>;

export type AiChatPluginApi = {
  mediaPicker: Pick<MediaPicker, "show">;
  pluginContext: PluginContext;
};

export type AiChat = {
  messages: AiMessage[];
  streamingId: string | null;
  pending: boolean;
  error: string | null;
  canUndo: boolean;
  image: string | null;
  attaching: boolean;
  send: (request: string) => void;
  stop: () => void;
  attachImage: (file: File) => void;
  attachImageUrl: (picked: AiChatPickedImage) => void;
  pickFromLibrary?: () => void;
  clearImage: () => void;
  undo: () => void;
  /** Wipes this scene's transcript. */
  clear: () => void;
};

type Options<TDoc> = {
  doc: TDoc;
  onChange: (doc: TDoc) => void;
  onRequest?: AiChatRequest<TDoc>;
  /** Scopes the transcript. */
  threadKey: string;
  pluginApi?: AiChatPluginApi;
};

let counter = 0;
/** Unique per message. Not crypto: this only has to be stable within a session. */
const nextId = () => `m${Date.now().toString(36)}-${counter++}`;

export const useAiChat = <TDoc>({
  doc,
  onChange,
  onRequest,
  threadKey,
  pluginApi,
}: Options<TDoc>): AiChat => {
  const [pending, setPending] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [attaching, setAttaching] = useState(false);

  // Subscribed by key, so a scene only re-renders for its own thread.
  const threads = useTranscriptStore((s) => s.threads);
  const messages = useMemo(
    () => threads[threadKey]?.messages ?? [],
    [threads, threadKey],
  );
  const canUndo = !!threads[threadKey]?.undo;

  const docRef = useRef(doc);
  docRef.current = doc;

  const imageRef = useRef<string | null>(null);
  imageRef.current = image;

  const abortRef = useRef<AbortController | null>(null);

  // Aborts on unmount
  useEffect(() => () => abortRef.current?.abort(), []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const send = useCallback(
    async (request: string) => {
      const trimmed = request.trim();
      if (!onRequest || !trimmed || pending) return;

      const store = useTranscriptStore.getState();
      setError(null);
      setPending(true);

      // Snapshotted before the user message is appended
      const history = toPromptHistory(store.messagesOf(threadKey));
      const before = docRef.current;
      const attached = imageRef.current;

      store.append(threadKey, {
        id: nextId(),
        role: "user",
        text: trimmed,
        image: attached,
        createdAt: Date.now(),
      });

      setImage(null);

      const assistantId = nextId();
      store.append(threadKey, {
        id: assistantId,
        role: "assistant",
        parts: [],
        createdAt: Date.now(),
      });
      setStreamingId(assistantId);

      const controller = new AbortController();
      abortRef.current = controller;

      // Whether this run has already captured its undo point. Per-run, and a ref
      // rather than state because the step handler reads it synchronously.
      const changedRef = { current: false };
      /** Set once the run reaches `done`, i.e. the image was actually consumed. */
      const completedRef = { current: false };

      try {
        await onRequest({
          request: trimmed,
          doc: before,
          history,
          image: attached,
          signal: controller.signal,
          onStep: (step) => {
            const s = useTranscriptStore.getState();
            switch (step.type) {
              case "thinkingDelta":
                s.appendDelta(threadKey, assistantId, "reasoning", step.text);
                break;
              case "messageDelta":
                s.appendDelta(threadKey, assistantId, "text", step.text);
                break;
              case "toolPending":
                s.upsertTool(threadKey, assistantId, step.name, "pending");
                break;
              case "tool":
                s.upsertTool(
                  threadKey,
                  assistantId,
                  step.name,
                  "done",
                  step.summary,
                );
                // Applied as it arrives, so the canvas reflects each edit while
                // the run continues instead of jumping at the end.
                if (step.doc) {
                  // Recorded on the first change only: `before` is the document
                  // as it was when the run started, which is what Undo has to
                  // return to no matter how many edits follow.
                  if (!changedRef.current) {
                    changedRef.current = true;
                    s.setUndo(threadKey, before);
                  }
                  onChange(step.doc);
                }
                break;
              case "toolError":
                // Kept rather than hidden: the model usually recovers on the
                // next turn, but if the run ends badly this is the trail that
                // explains why.
                s.upsertTool(
                  threadKey,
                  assistantId,
                  step.name,
                  "error",
                  step.message,
                );
                break;
              case "message":
                // The prose already streamed in as deltas. Only append when it
                // did not, so a non-streaming server does not go unreported and
                // a streaming one does not print twice.
                {
                  const current = s
                    .messagesOf(threadKey)
                    .find((m) => m.id === assistantId);
                  const streamed = (current?.parts ?? []).some(
                    (p) => p.type === "text",
                  );
                  if (!streamed) {
                    s.appendDelta(threadKey, assistantId, "text", step.text);
                  }
                }
                break;
              case "done":
                // Undo is only offered when something actually changed, so the
                // button never promises to revert a no-op.
                if (step.changed) {
                  if (!changedRef.current) {
                    changedRef.current = true;
                    s.setUndo(threadKey, before);
                  }
                  onChange(step.doc);
                }
                completedRef.current = true;
                break;
              case "fatal":
                s.update(threadKey, assistantId, { error: step.message });
                setError(step.message);
                break;
            }
          },
        });
      } catch (err) {
        // A run the user stopped is not a failure to report.
        if (!controller.signal.aborted) {
          const message =
            err instanceof Error ? err.message : "The request failed.";
          useTranscriptStore
            .getState()
            .update(threadKey, assistantId, { error: message });
          setError(message);
        }
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
        setPending(false);
        setStreamingId(null);
        if (!completedRef.current && attached && !imageRef.current) {
          setImage(attached);
        }
      }
    },
    [onRequest, onChange, pending, threadKey],
  );

  const attachImage = useCallback(async (file: File) => {
    setError(null);
    setAttaching(true);
    try {
      setImage(await fileToReferenceImage(file));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not read that image.",
      );
    } finally {
      setAttaching(false);
    }
  }, []);

  const attachImageUrl = useCallback(async (picked: AiChatPickedImage) => {
    setError(null);
    setAttaching(true);
    try {
      setImage(await urlToReferenceImage(resolvePickedImage(picked)));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load that image.",
      );
    } finally {
      setAttaching(false);
    }
  }, []);

  const pluginApiRef = useRef(pluginApi);
  pluginApiRef.current = pluginApi;

  const openLibrary = useCallback(async () => {
    const api = pluginApiRef.current;
    if (!api) return;
    setError(null);
    try {
      const results = await api.mediaPicker.show({
        type: "image",
        title: "Choose an image",
        pluginContext: api.pluginContext,
      });
      const picked = results?.[0];
      if (picked) await attachImageUrl(picked);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not open the library.",
      );
    }
  }, [attachImageUrl]);

  const pickFromLibrary = pluginApi ? openLibrary : undefined;

  const clearImage = useCallback(() => setImage(null), []);

  const undo = useCallback(() => {
    const store = useTranscriptStore.getState();
    const previous = store.undoOf(threadKey) as TDoc | null;
    if (!previous) return;
    onChange(previous);
    store.setUndo(threadKey, null);
    // Deliberately not recorded as a turn: the agent re-reads the document
    // through list_elements on every run, so a "reverted" line in the
    // transcript would be one more thing for it to misread.
  }, [onChange, threadKey]);

  const clear = useCallback(() => {
    stop();
    useTranscriptStore.getState().clear(threadKey);
    setError(null);
  }, [stop, threadKey]);

  return {
    messages,
    streamingId,
    pending,
    error,
    canUndo,
    image,
    attaching,
    send,
    stop,
    attachImage,
    attachImageUrl,
    pickFromLibrary,
    clearImage,
    undo,
    clear,
  };
};
