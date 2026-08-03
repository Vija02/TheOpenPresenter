import { useEffect, useMemo, useRef } from "react";

import { ElementView } from "../react/elements/ElementView";
import { fitFontSize, spansToHtml } from "../react/text/measure";
import { ResolvedTextElement } from "../template/resolve";

const TEXT_HOST_SELECTOR = ".lay--text-content";

/** Last text node in document order, or null when the subtree holds no text. */
const lastTextNode = (root: Node): Text | null => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let last: Text | null = null;
  while (walker.nextNode()) last = walker.currentNode as Text;
  return last;
};

export type TextEditOverlayProps = {
  /** Resolved element, used purely for its styling. */
  element: ResolvedTextElement;
  /** Raw template source, tokens and all. */
  value: string;
  onCommit: (value: string) => void;
  onCancel: () => void;
};

/**
 * In-place editor for a text element's template.
 * Shows the RAW `content` — `{{verses}}` rather than the substituted values
 */
export const TextEditOverlay = ({
  element,
  value,
  onCommit,
  onCancel,
}: TextEditOverlayProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLElement | null>(null);

  const committed = useRef(false);

  const editingElement = useMemo(
    () => ({ ...element, spans: [{ text: value, role: null }] }),
    [element, value],
  );

  const readHost = () => hostRef.current?.innerText ?? "";

  const commitOnce = () => {
    if (committed.current) return;
    committed.current = true;
    onCommit(readHost());
  };

  /** Re-run the auto-fit against the text as typed. */
  const refit = () => {
    if (element.fit === "declared") return;

    const host = hostRef.current;
    const box = ref.current;
    // TextElementView puts fontSize on the parent of the text container.
    const sized = host?.parentElement;
    if (!host || !box || !sized) return;

    const rect = box.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    // Read back rather than recompute: letterSpacing is declared in design
    // units and already resolved to px by the renderer's own styling.
    const letterSpacing = parseFloat(getComputedStyle(host).letterSpacing);

    sized.style.fontSize = `${fitFontSize({
      html: spansToHtml([{ text: host.innerText, role: null }], null),
      width: rect.width,
      height: rect.height,
      fontFamily: element.style.fontFamily,
      fontWeight: element.style.fontWeight,
      fontStyle: element.style.fontStyle,
      lineHeight: element.style.lineHeight,
      letterSpacing: Number.isFinite(letterSpacing) ? letterSpacing : 0,
    })}px`;
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Falls back to the wrapper if the renderer's structure ever changes, so a
    // missing seam degrades to "editable but unstyled" rather than "dead box".
    const host =
      el.querySelector<HTMLElement>(TEXT_HOST_SELECTOR) ?? (el as HTMLElement);
    hostRef.current = host;

    // Imperative rather than a prop: the node belongs to the renderer, and
    // threading edit concerns through ElementView would put editor state in
    // the output path.
    host.setAttribute("contenteditable", "plaintext-only");
    host.focus();

    // Caret to the end rather than select-all: double-clicking to append is
    // far more common than double-clicking to replace wholesale.
    const range = document.createRange();
    const lastText = lastTextNode(host);
    if (lastText) {
      // Inside the text node. Collapsing to the end of the HOST would park the
      // caret after its last child element, so the first keystroke would
      // create a bare sibling text node and render unstyled at the top-left.
      range.setStart(lastText, lastText.length);
      range.collapse(true);
    } else {
      range.selectNodeContents(host);
      range.collapse(false);
    }

    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    return () => {
      host.removeAttribute("contenteditable");
    };
  }, []);

  /**
   * Close on the first pointerdown landing outside the editor.
   * Needed so that we clear selection on selecting another element.
   */
  useEffect(() => {
    const handler = (event: PointerEvent) => {
      const el = ref.current;
      if (!el || el.contains(event.target as Node)) return;
      commitOnce();
    };
    document.addEventListener("pointerdown", handler, true);
    return () => document.removeEventListener("pointerdown", handler, true);
  });

  return (
    <div
      ref={ref}
      className="lay--editor-text-edit"
      // Focus and key events bubble from the host, so the handlers stay here
      // even though the editable node is nested inside.
      onBlur={commitOnce}
      // Input bubbles from the nested editable host. Covers typing, paste,
      // drag-drop and undo alike, which keydown would not.
      onInput={refit}
      // Keys must not reach the surface.
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") {
          e.preventDefault();
          committed.current = true;
          onCancel();
        }
      }}
      // Stops the click that places the caret from also reaching Selecto or re-triggering edit mode.
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <ElementView element={editingElement} placement="fill" />
    </div>
  );
};
