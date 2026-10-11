import { type RefObject, useLayoutEffect, useState } from "react";

/** em */
const MIN_COLUMN_WIDTH = 22;
const COLUMN_GAP = 3;
const SINGLE_COLUMN_MAX_WIDTH = 40;
const MAX_COLUMNS = 3;

const apply = (content: HTMLElement, columns: number) => {
  content.style.columnCount = String(columns);
  content.style.columnGap = `${COLUMN_GAP}em`;
  content.style.maxWidth = columns === 1 ? `${SINGLE_COLUMN_MAX_WIDTH}em` : "";
};

const px = (value: string) => {
  const parsed = parseFloat(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

/**
 * The fewest columns, up to what the width allows, that fit the whole song on
 * screen. A song that doesn't fit even then stays in one column, so scrolling
 * reads straight down.
 */
export const useAutoColumns = (
  scrollerRef: RefObject<HTMLElement | null>,
  contentRef: RefObject<HTMLElement | null>,
  deps: unknown[],
) => {
  const [columns, setColumns] = useState(1);

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    const content = contentRef.current;
    if (!scroller || !content) return;

    const measure = () => {
      const box = getComputedStyle(scroller);
      const width =
        scroller.clientWidth - px(box.paddingLeft) - px(box.paddingRight);
      const height =
        scroller.clientHeight - px(box.paddingTop) - px(box.paddingBottom);
      const em = px(getComputedStyle(content).fontSize);

      const byWidth = Math.max(
        1,
        Math.min(
          MAX_COLUMNS,
          Math.floor(
            (width + COLUMN_GAP * em) / ((MIN_COLUMN_WIDTH + COLUMN_GAP) * em),
          ),
        ),
      );

      let best = 1;
      for (let n = 1; n <= byWidth; n++) {
        apply(content, n);
        if (content.offsetHeight <= height) {
          best = n;
          break;
        }
      }
      apply(content, best);
      setColumns(best);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(scroller);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return columns;
};
