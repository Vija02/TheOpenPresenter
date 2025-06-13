import React, { useEffect, useState } from "react";

type PropTypes = { durationMs?: number; children?: React.ReactNode };

export function DeferredLoad({ durationMs = 1000, children }: PropTypes) {
  const [showItem, setShowItem] = useState(durationMs === 0 ? true : false);

  useEffect(() => {
    if (durationMs > 0) {
      const delay = setTimeout(() => {
        setShowItem(true);
      }, durationMs);

      return () => {
        clearTimeout(delay);
      };
    }
  }, [durationMs]);

  return showItem && <div className="animate-in fade-in">{children}</div>;
}
