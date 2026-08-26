import { RefObject, useEffect, useRef } from "react";

const isEditable = (node: EventTarget | null): boolean => {
  if (!(node instanceof HTMLElement)) return false;
  return (
    node.isContentEditable ||
    node.closest("input, textarea, select, [contenteditable]") !== null
  );
};

let lastPointed: HTMLElement | null = null;

export type LayoutShortcutHandlers = {
  onDelete: () => void;
  onDuplicate: () => void;
  onSelectAll: () => void;
  onUndo: () => void;
  onRedo: () => void;
  /** Return the payload to write, or null to let the browser handle the event. */
  onCopy: () => string | null;
  onCut: () => string | null;
  onPaste: (text: string) => void;
  /** Blocks every shortcut, e.g. while a text element is being edited in place. */
  disabled?: boolean;
};

export const useLayoutShortcuts = (
  root: RefObject<HTMLElement | null>,
  handlers: LayoutShortcutHandlers,
) => {
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    const markPointed = (event: Event) => {
      const container = root.current;
      if (container && event.target instanceof Node) {
        if (container.contains(event.target)) lastPointed = container;
      }
    };

    const isOurs = (event: Event): boolean => {
      const container = root.current;
      if (!container || ref.current.disabled) return false;
      if (isEditable(event.target)) return false;

      const active = document.activeElement;
      if (active && active !== document.body) return container.contains(active);
      return lastPointed === container;
    };

    const writeClipboard = (
      event: ClipboardEvent,
      payload: string | null,
    ): boolean => {
      if (payload === null || !event.clipboardData) return false;
      event.clipboardData.setData("text/plain", payload);
      event.preventDefault();
      return true;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (!isOurs(event)) return;

      const mod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();

      if (!mod && (event.key === "Delete" || event.key === "Backspace")) {
        event.preventDefault();
        ref.current.onDelete();
        return;
      }

      if (!mod) return;

      if (key === "z") {
        event.preventDefault();
        if (event.shiftKey) ref.current.onRedo();
        else ref.current.onUndo();
        return;
      }
      // Windows convention, alongside Shift+Cmd+Z.
      if (key === "y") {
        event.preventDefault();
        ref.current.onRedo();
        return;
      }
      if (key === "d") {
        event.preventDefault();
        ref.current.onDuplicate();
        return;
      }
      if (key === "a") {
        event.preventDefault();
        ref.current.onSelectAll();
      }
    };

    const onCopy = (event: ClipboardEvent) => {
      if (!isOurs(event)) return;
      writeClipboard(event, ref.current.onCopy());
    };

    const onCut = (event: ClipboardEvent) => {
      if (!isOurs(event)) return;
      // Only delete once the payload is safely on the clipboard.
      if (writeClipboard(event, ref.current.onCut())) ref.current.onDelete();
    };

    const onPaste = (event: ClipboardEvent) => {
      if (!isOurs(event)) return;
      const text = event.clipboardData?.getData("text/plain");
      if (!text) return;
      event.preventDefault();
      ref.current.onPaste(text);
    };

    document.addEventListener("pointerdown", markPointed, true);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("copy", onCopy);
    document.addEventListener("cut", onCut);
    document.addEventListener("paste", onPaste);
    return () => {
      if (lastPointed === root.current) lastPointed = null;
      document.removeEventListener("pointerdown", markPointed, true);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("cut", onCut);
      document.removeEventListener("paste", onPaste);
    };
  }, [root]);
};
