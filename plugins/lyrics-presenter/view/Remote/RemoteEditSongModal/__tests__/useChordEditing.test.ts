import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useChordEditing } from "../useChordEditing";

const PLAIN = ["[Verse 1]", "Amazing grace", "That saved"].join("\n");
const CHORDED = ["[Verse 1]", "[G]Amazing grace", "That [D]saved"].join("\n");

describe("useChordEditing", () => {
  it("starts with chords hidden", () => {
    const { result } = renderHook(() => useChordEditing(CHORDED, vi.fn()));

    expect(result.current.showChords).toBe(false);
    expect(result.current.hasChords).toBe(true);
    expect(result.current.editorContent).toBe(
      ["[Verse 1]", "Amazing grace", "That saved"].join("\n"),
    );
  });

  it("shows the chorded text once chords are shown", () => {
    const { result } = renderHook(() => useChordEditing(CHORDED, vi.fn()));

    act(() => result.current.toggleShowChords());

    expect(result.current.showChords).toBe(true);
    expect(result.current.editorContent).toBe(CHORDED);
  });

  it("turns chords on when the user types one while they are hidden", () => {
    // Otherwise the lyrics-only view swallows the chord they just typed.
    const onChange = vi.fn();
    const { result } = renderHook(() => useChordEditing(PLAIN, onChange));

    act(() =>
      result.current.onEditorChange(
        ["[Verse 1]", "[G]Amazing grace", "That saved"].join("\n"),
      ),
    );

    expect(result.current.showChords).toBe(true);
    expect(onChange).toHaveBeenCalledWith(
      ["[Verse 1]", "[G]Amazing grace", "That saved"].join("\n"),
    );
  });

  it("turns chords on for an OpenSong chord line too", () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useChordEditing(PLAIN, onChange));

    act(() => result.current.onEditorChange(`${PLAIN}\n.G C`));

    expect(result.current.showChords).toBe(true);
  });

  it("stays hidden for an ordinary lyric edit", () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useChordEditing(PLAIN, onChange));

    act(() =>
      result.current.onEditorChange(
        ["[Verse 1]", "Amazing grace", "That saved me"].join("\n"),
      ),
    );

    expect(result.current.showChords).toBe(false);
  });

  it("merges a hidden-chords edit back into the chorded text", () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useChordEditing(CHORDED, onChange));

    act(() =>
      result.current.onEditorChange(
        ["[Verse 1]", "Amazing grace", "That saved me"].join("\n"),
      ),
    );

    expect(onChange).toHaveBeenCalledWith(
      ["[Verse 1]", "[G]Amazing grace", "That [D]saved me"].join("\n"),
    );
  });

  it("only offers the chord toolbar when chords exist and are shown", () => {
    const { result: plain } = renderHook(() => useChordEditing(PLAIN, vi.fn()));
    act(() => plain.current.toggleShowChords());
    expect(plain.current.showChordToolbar).toBe(false);

    const { result: chorded } = renderHook(() =>
      useChordEditing(CHORDED, vi.fn()),
    );
    expect(chorded.current.showChordToolbar).toBe(false);
    act(() => chorded.current.toggleShowChords());
    expect(chorded.current.showChordToolbar).toBe(true);
  });
});
