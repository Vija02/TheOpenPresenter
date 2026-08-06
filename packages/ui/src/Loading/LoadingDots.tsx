import { cx } from "class-variance-authority";
import { useEffect, useState } from "react";

import "./LoadingDots.css";

type PropTypes = {
  count?: number;
  defer?: number;
  className?: string;
  label?: string;
};

export function LoadingDots({
  count = 5,
  defer = 0,
  className,
  label = "Loading",
}: PropTypes) {
  const [show, setShow] = useState(defer === 0);

  useEffect(() => {
    if (defer <= 0) return;
    const timer = setTimeout(() => setShow(true), defer);
    return () => clearTimeout(timer);
  }, [defer]);

  if (!show) return null;

  return (
    <span
      className={cx("ui--loading-dots animate-in fade-in", className)}
      // Presented as one indicator rather than a handful of meaningless spans.
      role="status"
      aria-live="off"
      aria-label={label || undefined}
    >
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className="ui--loading-dots__dot"
          style={{
            animationDelay: `-${((count - 1 - i) / count) * 0.6}s`,
          }}
        />
      ))}
    </span>
  );
}
