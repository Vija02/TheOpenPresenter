import { Box, Flex } from "@chakra-ui/react";
import { projectName } from "@repo/config";
import { Logo } from "@repo/ui";
import * as React from "react";
import { useEffect } from "react";
import { Link as WouterLink } from "wouter";

import { Footer } from "./Footer";
import { StandardWidth } from "./StandardWidth";

export const contentMinHeight = "calc(100vh - 80px)";

export interface SharedLayoutSkeletonProps {
  title?: string;
  overrideTitle?: string;
  noFooter?: boolean;
  navbarLeft?: React.ReactNode;
  navbarRight?: React.ReactNode;
  children?: React.ReactNode;
}

export function SharedLayoutSkeleton({
  title,
  overrideTitle,
  noFooter = false,
  navbarLeft,
  navbarRight,
  children,
}: SharedLayoutSkeletonProps) {
  const finalTitle =
    overrideTitle ?? (title ? `${title} — ${projectName}` : projectName);

  useEffect(() => {
    document.title = finalTitle;
  }, [finalTitle]);

  return (
    <Box>
      <StandardWidth style={{ background: "black", height: "80px" }}>
        <Flex
          w="100%"
          height="100%"
          justify="space-between"
          alignItems="center"
          flexWrap="wrap"
        >
          {navbarLeft}
          <WouterLink href="/">
            <Logo height="40px" />
          </WouterLink>
          {navbarRight}
        </Flex>
      </StandardWidth>
      <Box style={{ minHeight: contentMinHeight }}>{children}</Box>
      {noFooter ? null : <Footer />}
    </Box>
  );
}
