import { Fade } from "@chakra-ui/react";
import React, { useEffect, useState } from "react";

type PropTypes = { durationMs?: number; children?: React.ReactNode };

export function DeferredLoad({ durationMs = 1500, children }: PropTypes) {
  const [showItem, setShowItem] = useState(false);

  useEffect(() => {
    const delay = setTimeout(() => {
      setShowItem(true);
    }, durationMs);

    return () => {
      clearTimeout(delay);
    };
  }, [durationMs]);

  return <Fade in={showItem}>{children}</Fade>;
}
