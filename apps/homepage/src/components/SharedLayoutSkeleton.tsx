import { Box, Flex } from "@chakra-ui/react";
import { projectName } from "@repo/config";
import { Logo } from "@repo/ui";
import Head from "next/head";
import NextLink from "next/link";
import * as React from "react";

import { Footer } from "./Footer";
import { StandardWidth } from "./StandardWidth";

export const contentMinHeight = "calc(100vh - 80px)";

export interface SharedLayoutSkeletonProps {
  title?: string;
  overrideTitle?: string;
  description?: string;
  noFooter?: boolean;
  navbarRight?: React.ReactNode;
  bannerUrl?: string;
  children?: React.ReactNode;
}

export function SharedLayoutSkeleton({
  title,
  overrideTitle,
  description,
  noFooter = false,
  navbarRight,
  bannerUrl = "/images/social_banner.jpg",
  children,
}: SharedLayoutSkeletonProps) {
  const finalTitle =
    overrideTitle ?? (title ? `${title} — ${projectName}` : projectName);
  const finalDescription =
    description ??
    "Present everything with a few clicks - Your slides, videos, websites, music and more seamlessly";

  return (
    <Box>
      <Head>
        <title>{finalTitle}</title>

        <meta name="title" property="og:title" content={finalTitle} />
        <meta name="type" property="og:type" content="website" />
        <meta
          name="canonical"
          property="og:url"
          content="https://theopenpresenter.com"
        />
        <meta
          name="description"
          property="og:description"
          content={finalDescription}
        />

        <link
          rel="apple-touch-icon"
          sizes="180x180"
          href="/favicon/apple-touch-icon.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="32x32"
          href="/favicon/favicon-32x32.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="16x16"
          href="/favicon/favicon-16x16.png"
        />
        <link rel="manifest" href="/favicon/site.webmanifest" />
        <link
          rel="mask-icon"
          href="/favicon/safari-pinned-tab.svg"
          color="#ee414c"
        />
        <meta name="msapplication-TileColor" content="#ee414c" />
        <meta name="theme-color" content="#EE414C" />
        <link rel="shortcut icon" href="/favicon/favicon.ico" />
        <meta
          name="msapplication-config"
          content="/favicon/browserconfig.xml"
        />
        <meta name="author" content="Michael Salim" />
        <meta
          property="og:image"
          content={process.env.NEXT_PUBLIC_ROOT_URL + bannerUrl}
        />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@IamMichaelSalim" />
        <meta name="twitter:title" content={finalTitle} />
        <meta name="twitter:description" content={finalDescription} />
        <meta
          name="twitter:image"
          content={process.env.NEXT_PUBLIC_ROOT_URL + bannerUrl}
        />
      </Head>

      <StandardWidth bg="black" height="80px">
        <Flex
          w="100%"
          height="100%"
          justify="space-between"
          alignItems="center"
          flexWrap="wrap"
        >
          <NextLink href="/">
            <Logo height="40px" />
          </NextLink>
          {navbarRight}
        </Flex>
      </StandardWidth>
      <Box style={{ minHeight: contentMinHeight }}>{children}</Box>
      {noFooter ? null : <Footer />}
    </Box>
  );
}
