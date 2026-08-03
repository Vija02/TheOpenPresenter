import { useRef } from "react";

import { splitTemplate } from "../../../template/tokens";

/**
 * Textarea that highlights `{{token}}` runs
 */
export const TokenTextArea = ({
  value,
  onChange,
  knownKeys = [],
  rows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  /** Keys the data provider supplies. Anything else is flagged as unbound. */
  knownKeys?: string[];
  rows?: number;
}) => {
  const backdropRef = useRef<HTMLDivElement>(null);

  const shared =
    "w-full px-3 py-1 text-sm font-sans leading-normal tracking-normal whitespace-pre-wrap break-words";

  return (
    <div className="relative">
      <div
        ref={backdropRef}
        aria-hidden
        className={`${shared} absolute inset-0 overflow-hidden pointer-events-none rounded-sm border border-transparent text-primary`}
      >
        {splitTemplate(value).map((seg, i) =>
          seg.type === "token" ? (
            <span
              key={i}
              // Colour ONLY
              className={
                // Unbound tokens render as nothing at output time, so they are worth distinguishing
                knownKeys.includes(seg.key)
                  ? "text-sky-600 dark:text-sky-400"
                  : "text-amber-600 dark:text-amber-400"
              }
            >
              {seg.text}
            </span>
          ) : (
            <span key={i}>{seg.text}</span>
          ),
        )}
        {/* A trailing newline collapses in a div but not in a textarea; this
            keeps the two the same height so scrolling stays in step. */}
        {"\u200b"}
      </div>

      <textarea
        rows={rows}
        // Text is transparent so the backdrop's coloured glyphs show through.
        className={`${shared} relative block resize-y rounded-sm border border-stroke bg-transparent text-transparent caret-primary outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:outline-none`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={(e) => {
          const el = backdropRef.current;
          if (!el) return;
          el.scrollTop = e.currentTarget.scrollTop;
          el.scrollLeft = e.currentTarget.scrollLeft;
        }}
      />
    </div>
  );
};
