import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  cn,
  useOverlayToggle,
} from "@repo/ui";
import { useMemo, useState } from "react";
import { VscChevronRight } from "react-icons/vsc";

import { BibleBookIndex, BibleBookMeta } from "../../../src/types";
import { buildReference } from "./bookIndex";

type BiblePickerProps = {
  index: BibleBookIndex;
  translationName?: string;
  /** Called with a reference string, e.g. "John 3:16" or "John 3:16-18". */
  onPick: (reference: string) => void;
};

const BiblePicker = ({ index, translationName, onPick }: BiblePickerProps) => {
  const { isOpen, onToggle } = useOverlayToggle();

  const [book, setBook] = useState<BibleBookMeta | null>(null);
  const [chapter, setChapter] = useState<number | null>(null);
  const [range, setRange] = useState<{ start: number; end: number } | null>(
    null,
  );

  const reset = () => {
    setBook(null);
    setChapter(null);
    setRange(null);
  };

  const verseCount = useMemo(() => {
    if (!book || chapter == null) return 0;
    return book.chapters[chapter - 1] ?? 0;
  }, [book, chapter]);

  const stage: "book" | "chapter" | "verse" =
    book == null ? "book" : chapter == null ? "chapter" : "verse";

  const commit = (reference: string) => {
    onPick(reference);
    reset();
    onToggle?.();
  };

  const onVerseTap = (v: number) => {
    if (!range || v < range.start) setRange({ start: v, end: v });
    else setRange({ start: range.start, end: v });
  };

  const pendingReference =
    book && chapter != null && range
      ? buildReference(book.name, chapter, range.start, range.end)
      : null;

  return (
    <Dialog open={isOpen ?? false} onOpenChange={onToggle ?? (() => {})}>
      <DialogContent size="2xl">
        <DialogHeader className="px-3 md:px-6">
          <DialogTitle>
            <div className="flex items-center gap-1 flex-wrap text-base">
              <button
                type="button"
                className={cn(
                  "hover:underline",
                  stage === "book" ? "font-bold" : "text-secondary",
                )}
                onClick={reset}
              >
                {translationName ?? "Books"}
              </button>
              {book && (
                <>
                  <VscChevronRight className="text-secondary" />
                  <button
                    type="button"
                    className={cn(
                      "hover:underline",
                      stage === "chapter" ? "font-bold" : "text-secondary",
                    )}
                    onClick={() => {
                      setChapter(null);
                      setRange(null);
                    }}
                  >
                    {book.name}
                  </button>
                </>
              )}
              {book && chapter != null && (
                <>
                  <VscChevronRight className="text-secondary" />
                  <span className="font-bold">Chapter {chapter}</span>
                </>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        <DialogBody className="px-3 md:px-6">
          {stage === "book" && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {index.map((b) => (
                <button
                  key={b.n}
                  type="button"
                  onClick={() => setBook(b)}
                  className="h-10 px-2 rounded border border-stroke bg-surface-primary hover:bg-surface-primary-hover text-sm text-left truncate cursor-pointer"
                  title={b.name}
                >
                  {b.name}
                </button>
              ))}
            </div>
          )}

          {stage === "chapter" && book && (
            <div className="grid grid-cols-5 sm:grid-cols-8 gap-2">
              {Array.from(
                { length: book.chapters.length },
                (_, i) => i + 1,
              ).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setChapter(c)}
                  className="h-10 rounded border border-stroke bg-surface-primary hover:bg-surface-primary-hover text-sm cursor-pointer"
                >
                  {c}
                </button>
              ))}
            </div>
          )}

          {stage === "verse" && book && chapter != null && (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-6 sm:grid-cols-10 gap-2">
                {Array.from({ length: verseCount }, (_, i) => i + 1).map(
                  (v) => {
                    const inRange = range && v >= range.start && v <= range.end;
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => onVerseTap(v)}
                        className={cn(
                          "h-10 rounded border text-sm cursor-pointer",
                          inRange
                            ? "border-primary bg-primary/10 font-bold"
                            : "border-stroke bg-surface-primary hover:bg-surface-primary-hover",
                        )}
                      >
                        {v}
                      </button>
                    );
                  },
                )}
              </div>
              <p className="text-xs text-secondary">
                Tap a verse to select it, then tap another to extend the range.
              </p>
            </div>
          )}
        </DialogBody>

        <DialogFooter className="px-3 md:px-6 pb-3">
          <div className="flex justify-end gap-2 w-full">
            {stage === "verse" && book && chapter != null && (
              <Button
                variant="outline"
                onClick={() => commit(buildReference(book.name, chapter))}
              >
                Whole chapter
              </Button>
            )}
            {pendingReference && (
              <Button
                variant="success"
                onClick={() => commit(pendingReference)}
                data-testid="bible-picker-add"
              >
                Add {pendingReference}
              </Button>
            )}
            <Button variant="ghost" onClick={onToggle}>
              Cancel
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BiblePicker;
