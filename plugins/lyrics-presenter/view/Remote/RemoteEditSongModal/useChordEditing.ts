import { useCallback, useMemo, useState } from "react";

import {
  mergeLyricEdit,
  toLyricsOnly,
} from "../../../src/chords/mergeLyricEdit";
import { contentHasChords } from "../../../src/chords/song";

/** Editing a song's lyrics with its chords shown or hidden */
export const useChordEditing = (
  content: string,
  onChange: (content: string) => void,
) => {
  const [showChords, setShowChords] = useState(false);

  const hasChords = useMemo(() => contentHasChords(content), [content]);

  const editorContent = useMemo(
    () => (showChords ? content : toLyricsOnly(content)),
    [content, showChords],
  );

  const onEditorChange = useCallback(
    (value: string) => {
      if (showChords) {
        onChange(value);
        return;
      }

      // The user typed a chord while chords were hidden. Merging keeps it, but
      // the lyrics-only view would swallow it again, so show chords instead of
      // letting the thing they just typed vanish.
      if (contentHasChords(value)) setShowChords(true);

      onChange(mergeLyricEdit(content, value));
    },
    [content, onChange, showChords],
  );

  const toggleShowChords = useCallback(
    () => setShowChords((shown) => !shown),
    [],
  );

  return {
    hasChords,
    showChords,
    toggleShowChords,
    editorContent,
    onEditorChange,
    showChordToolbar: hasChords && showChords,
  };
};
