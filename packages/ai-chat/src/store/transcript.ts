import type { AiTurn } from "@repo/base-types";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/**
 * The chat transcript, keyed by an arbitrary thread key
 */

export type AiMessagePart =
  | { type: "reasoning"; text: string }
  | { type: "text"; text: string }
  | {
      type: "tool";
      name: string;
      /** Absent while the call's arguments are still streaming. */
      summary?: string;
      state: "pending" | "done" | "error";
    };

export type AiMessage = {
  id: string;
  role: "user" | "assistant";
  text?: string;
  parts?: AiMessagePart[];
  image?: string | null;
  error?: string;
  createdAt: number;
};

type Thread = {
  messages: AiMessage[];
  undo: unknown | null;
};

type TranscriptState = {
  threads: Record<string, Thread>;
};

type TranscriptActions = {
  messagesOf: (key: string) => AiMessage[];
  undoOf: (key: string) => unknown | null;
  append: (key: string, message: AiMessage) => void;
  update: (key: string, id: string, patch: Partial<AiMessage>) => void;
  appendDelta: (
    key: string,
    id: string,
    kind: "reasoning" | "text",
    delta: string,
  ) => void;
  flushDeltas: () => void;
  upsertTool: (
    key: string,
    id: string,
    name: string,
    state: "pending" | "done" | "error",
    summary?: string,
  ) => void;
  setUndo: (key: string, doc: unknown | null) => void;
  clear: (key: string) => void;
};

const EMPTY: AiMessage[] = [];

const emptyThread = (): Thread => ({ messages: [], undo: null });

type DeltaKind = "reasoning" | "text";
type PendingDelta = { key: string; id: string; kind: DeltaKind; text: string };

const deltaBuffer = new Map<string, PendingDelta>();
let flushScheduled = false;

const schedule = (fn: () => void) => {
  if (typeof queueMicrotask === "function") queueMicrotask(fn);
  else Promise.resolve().then(fn);
};

const applyBufferedDeltas =
  (batch: PendingDelta[]) =>
  (state: TranscriptState): TranscriptState => {
    let threads = state.threads;
    let mutated = false;

    for (const { key, id, kind, text } of batch) {
      const thread = threads[key];
      if (!thread) continue;

      const messages = thread.messages.map((m) => {
        if (m.id !== id) return m;
        const parts = m.parts ? [...m.parts] : [];
        const tail = parts[parts.length - 1];
        if (tail?.type === kind) {
          parts[parts.length - 1] = { ...tail, text: tail.text + text };
        } else {
          parts.push({ type: kind, text });
        }
        return { ...m, parts };
      });

      threads = { ...threads, [key]: { ...thread, messages } };
      mutated = true;
    }

    return mutated ? { threads } : state;
  };

// Flush on a microtask so the store `set` (and its re-render) runs outside the
// current call stack, avoiding re-entering the web-component render.
const bufferDelta = (
  key: string,
  id: string,
  kind: DeltaKind,
  delta: string,
  set: (fn: (state: TranscriptState) => TranscriptState) => void,
) => {
  const bufKey = `${key}\u0000${id}\u0000${kind}`;
  const existing = deltaBuffer.get(bufKey);
  if (existing) existing.text += delta;
  else deltaBuffer.set(bufKey, { key, id, kind, text: delta });

  if (flushScheduled) return;
  flushScheduled = true;
  schedule(() => flushDeltaBuffer(set));
};

const flushDeltaBuffer = (
  set: (fn: (state: TranscriptState) => TranscriptState) => void,
) => {
  flushScheduled = false;
  if (deltaBuffer.size === 0) return;
  const batch = [...deltaBuffer.values()];
  deltaBuffer.clear();
  set(applyBufferedDeltas(batch));
};

// Caps stored history
const MAX_MESSAGES = 60;

const trim = (messages: AiMessage[]): AiMessage[] =>
  messages.length <= MAX_MESSAGES
    ? messages
    : messages.slice(messages.length - MAX_MESSAGES);

export const useTranscriptStore = create<TranscriptState & TranscriptActions>()(
  persist(
    (set, get) => ({
      threads: {},

      messagesOf: (key) => get().threads[key]?.messages ?? EMPTY,
      undoOf: (key) => get().threads[key]?.undo ?? null,

      append: (key, message) =>
        set((state) => {
          const thread = state.threads[key] ?? emptyThread();
          return {
            threads: {
              ...state.threads,
              [key]: {
                ...thread,
                messages: trim([...thread.messages, message]),
              },
            },
          };
        }),

      update: (key, id, patch) =>
        set((state) => {
          const thread = state.threads[key];
          if (!thread) return state;
          return {
            threads: {
              ...state.threads,
              [key]: {
                ...thread,
                messages: thread.messages.map((m) =>
                  m.id === id ? { ...m, ...patch } : m,
                ),
              },
            },
          };
        }),

      appendDelta: (key, id, kind, delta) =>
        bufferDelta(key, id, kind, delta, set),

      flushDeltas: () => flushDeltaBuffer(set),

      upsertTool: (key, id, name, state_, summary) =>
        set((state) => {
          const thread = state.threads[key];
          if (!thread) return state;
          return {
            threads: {
              ...state.threads,
              [key]: {
                ...thread,
                messages: thread.messages.map((m) => {
                  if (m.id !== id) return m;
                  const parts = m.parts ? [...m.parts] : [];
                  // Settle the pending call with this name rather than appending
                  // beside it, or every tool shows up twice.
                  const index = parts.findIndex(
                    (p) =>
                      p.type === "tool" &&
                      p.name === name &&
                      p.state === "pending",
                  );
                  const part: AiMessagePart = {
                    type: "tool",
                    name,
                    state: state_,
                    ...(summary !== undefined ? { summary } : {}),
                  };
                  if (index === -1) parts.push(part);
                  else parts[index] = part;
                  return { ...m, parts };
                }),
              },
            },
          };
        }),

      setUndo: (key, doc) =>
        set((state) => {
          const thread = state.threads[key] ?? emptyThread();
          return {
            threads: { ...state.threads, [key]: { ...thread, undo: doc } },
          };
        }),

      clear: (key) =>
        set((state) => {
          const { [key]: _removed, ...rest } = state.threads;
          return { threads: rest };
        }),
    }),
    {
      name: "ai-chat-transcript",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        threads: Object.fromEntries(
          Object.entries(state.threads).map(([key, thread]) => [
            key,
            { messages: thread.messages, undo: null },
          ]),
        ),
      }),
    },
  ),
);

const MAX_HISTORY_TURNS = 20;
const MAX_HISTORY_CONTENT = 4000;

const clip = (text: string, max: number): string =>
  text.length > max ? text.slice(text.length - max) : text;

export const toPromptHistory = (messages: AiMessage[]): AiTurn[] => {
  const turns = messages
    .map((message) => {
      if (message.role === "user") {
        return { role: "user" as const, content: message.text ?? "" };
      }
      // Only the prose survives into the next prompt
      const text = (message.parts ?? [])
        .filter((part) => part.type === "text")
        .map((part) => (part as { text: string }).text)
        .join("\n")
        .trim();
      return { role: "assistant" as const, content: text };
    })
    .filter((turn) => turn.content.length > 0)
    .map((turn) => ({
      ...turn,
      content: clip(turn.content, MAX_HISTORY_CONTENT),
    }));

  return turns.slice(-MAX_HISTORY_TURNS);
};
