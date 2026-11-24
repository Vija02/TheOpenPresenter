import { ReactNode, useEffect, useRef, useState } from "react";

import { scrollParentOf } from "./scrollParent";

export const FontSampleRow = ({
  name,
  details,
  fontFamily,
  sample,
  size,
  loaded = true,
  selected = false,
  onClick,
  onVisible,
  action,
}: {
  name: string;
  details?: ReactNode[];
  fontFamily: string;
  sample: string;
  size: number;
  /** False hides the sample, to avoid a flash of the fallback */
  loaded?: boolean;
  selected?: boolean;
  onClick?: () => void;
  /** Once, when first scrolled into view */
  onVisible?: () => void;
  action?: ReactNode;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    if (!onVisible || seen || !ref.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          onVisible();
          observer.disconnect();
        }
      },
      { root: scrollParentOf(ref.current), rootMargin: "300px" },
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [onVisible, seen]);

  const shown = details?.filter(Boolean) ?? [];

  return (
    <div
      ref={ref}
      className={`bp--font-row ${onClick ? "bp--font-row--clickable" : ""} ${
        selected ? "bp--font-row--selected" : ""
      }`}
      role={onClick ? "option" : undefined}
      aria-selected={onClick ? selected : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <div className="bp--font-row__head">
        <span className="bp--font-row__name">{name}</span>
        {shown.map((d, i) => (
          <span key={i} className="bp--font-row__detail">
            {d}
          </span>
        ))}
        {action && <div className="bp--font-row__action">{action}</div>}
      </div>
      <div
        className={`bp--font-row__sample ${
          loaded ? "" : "bp--font-row__sample--loading"
        }`}
        dir="auto"
        style={{ fontFamily, fontSize: size }}
      >
        {sample}
      </div>
    </div>
  );
};
