import { projectName } from "@repo/config";
import { desktop } from "@repo/desktop-bridge";
import { Logo } from "@repo/ui";
import * as React from "react";
import { useEffect } from "react";
import { Link as WouterLink } from "wouter";

import { Footer } from "./Footer";
import { StandardWidth } from "./StandardWidth";

const HEADER_HEIGHT = 80;

export const contentMinHeight = desktop.isDesktop
  ? "100dvh"
  : `calc(100dvh - ${HEADER_HEIGHT}px)`;

export type SharedLayoutSkeletonProps = {
  title?: string;
  overrideTitle?: string;
  noFooter?: boolean;
  navbarLeft?: React.ReactNode;
  navbarRight?: React.ReactNode;
  children?: React.ReactNode;
};

export function SharedLayoutSkeleton({
  title,
  overrideTitle,
  noFooter = false,
  navbarLeft,
  navbarRight,
  children,
}: SharedLayoutSkeletonProps) {
  const finalTitle =
    overrideTitle ?? (title ? `${title} | ${projectName}` : projectName);

  useEffect(() => {
    document.title = finalTitle;
  }, [finalTitle]);

  const isDesktop = desktop.isDesktop;

  return (
    <div>
      {!isDesktop && (
        <StandardWidth
          style={{ background: "black", minHeight: `${HEADER_HEIGHT}px` }}
        >
          <div className="w-full h-full flex justify-between items-center flex-wrap gap-y-2">
            {navbarLeft}
            <WouterLink href="/">
              <Logo height="40px" />
            </WouterLink>
            {navbarRight}
          </div>
        </StandardWidth>
      )}
      <div style={{ minHeight: contentMinHeight }}>{children}</div>
      {!isDesktop && !noFooter && <Footer />}
    </div>
  );
}
