import { desktop } from "@repo/desktop-bridge";
import type { MouseEvent, MouseEventHandler } from "react";

/**
 * Studio can't open tabs: our own pages open in place,
 * other sites in the system browser
 */
export const newTabProps = <T extends HTMLElement>(
  href: string | undefined,
  onClick: MouseEventHandler<T> | undefined,
): {
  target?: string;
  rel?: string;
  onClick?: MouseEventHandler<T>;
} => {
  if (!desktop.isDesktop) return { target: "_blank", rel: "noopener", onClick };
  if (!href) return { onClick };

  const url = new URL(href, window.location.href);
  if (url.origin === window.location.origin) return { onClick };

  return {
    onClick: (e: MouseEvent<T>) => {
      onClick?.(e);
      if (e.defaultPrevented) return;
      e.preventDefault();
      void desktop.openExternal(url.href);
    },
  };
};
