import { useCallback, useMemo, useRef, useState } from "react";

import { LayoutDoc } from "../schema/document";

export type LayoutHistory = {
  onChange: (doc: LayoutDoc) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
};

type Stacks = { past: LayoutDoc[]; future: LayoutDoc[] };

const EMPTY: Stacks = { past: [], future: [] };

const LIMIT = 100;

/**
 * Snapshot undo/redo for a controlled LayoutDoc
 * Only edits routed through the returned `onChange` are recorded
 */
export const useLayoutHistory = (
  doc: LayoutDoc,
  onChange: (doc: LayoutDoc) => void,
): LayoutHistory => {
  const [stacks, setStacks] = useState<Stacks>(EMPTY);

  // Read inside callbacks that must stay stable across edits, so refs carry
  // the live values rather than the ones captured at definition time
  const docRef = useRef(doc);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const stacksRef = useRef(stacks);
  stacksRef.current = stacks;

  const pendingRef = useRef(false);

  const emit = (next: LayoutDoc) => {
    pendingRef.current = true;
    onChangeRef.current(next);
  };

  if (doc !== docRef.current) {
    const ours = pendingRef.current;
    pendingRef.current = false;
    docRef.current = doc;
    // Undoing onto a snapshot taken of a different subject (another slide, a
    // freshly applied template, a collaborator's document) would silently
    // destroy that other work.
    if (!ours && stacksRef.current !== EMPTY) {
      stacksRef.current = EMPTY;
      setStacks(EMPTY);
    }
  }

  const record = useCallback((next: LayoutDoc) => {
    const previous = docRef.current;
    if (next === previous) return;
    setStacks(({ past }) => ({
      past: [...past, previous].slice(-LIMIT),
      future: [],
    }));
    emit(next);
  }, []);

  const undo = useCallback(() => {
    const { past, future } = stacksRef.current;
    const previous = past[past.length - 1];
    if (!previous) return;
    setStacks({
      past: past.slice(0, -1),
      future: [docRef.current, ...future].slice(0, LIMIT),
    });
    emit(previous);
  }, []);

  const redo = useCallback(() => {
    const { past, future } = stacksRef.current;
    const next = future[0];
    if (!next) return;
    setStacks({
      past: [...past, docRef.current].slice(-LIMIT),
      future: future.slice(1),
    });
    emit(next);
  }, []);

  return useMemo(
    () => ({
      onChange: record,
      undo,
      redo,
      canUndo: stacks.past.length > 0,
      canRedo: stacks.future.length > 0,
    }),
    [record, undo, redo, stacks],
  );
};
