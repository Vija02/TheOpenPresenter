"use client";

import { StandardWidth } from "@/components/StandardWidth";
import BgShapes from "@/components/ui/bg-shapes";
import Header from "@/components/ui/header";
import { css } from "@/styled-system/css";
import { Box, Flex, HStack, VStack, styled } from "@/styled-system/jsx";
import { companyName } from "@repo/config";
import { Logo } from "@repo/ui";
import NextLink from "next/link";

export default function DefaultLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Box minH="100vh">
        <BgShapes />
        <Header />

        <styled.main flexGrow={1}>{children}</styled.main>
      </Box>

      <Box p={4} bgColor="#1F252A">
        <StandardWidth>
          <Flex
            justifyContent="space-between"
            w="100%"
            flexDirection={["column", "row"]}
            gap={10}
          >
            <VStack alignItems="flex-start" gap={0}>
              <Logo height={40} />
              <Box pb={5} />
              <p className={css({ color: "white" })}>
                &copy; {new Date().getFullYear()} {companyName}
              </p>
              <NextLink
                href="/support"
                color="white"
                className={css({
                  fontSize: "sm",
                  fontWeight: "600",
                  _hover: {
                    textDecoration: "underline",
                  },
                })}
              >
                Support
              </NextLink>
              <NextLink
                href="/privacy"
                color="white"
                className={css({
                  fontSize: "sm",
                  fontWeight: "600",
                  _hover: {
                    textDecoration: "underline",
                  },
                })}
              >
                Privacy Policy
              </NextLink>
            </VStack>
            <HStack gap={14} alignItems="flex-start">
              <Flex flexDir="column" alignItems="flex-start">
                <styled.p
                  textAlign="end"
                  fontSize="lg"
                  color="white"
                  mb={4}
                  fontWeight="bold"
                >
                  CONTACT
                </styled.p>
                <VStack alignItems="flex-start" gap={1}>
                  <NextLink
                    href="mailto:support@theopenpresenter.com"
                    className={css({
                      fontSize: "md",
                      fontWeight: "500",
                      _hover: {
                        textDecoration: "underline",
                      },
                    })}
                  >
                    Email
                  </NextLink>
                  <NextLink
                    href="/support"
                    className={css({
                      fontSize: "md",
                      fontWeight: "500",
                      _hover: {
                        textDecoration: "underline",
                      },
                    })}
                  >
                    Support
                  </NextLink>
                </VStack>
              </Flex>
            </HStack>
          </Flex>
        </StandardWidth>
      </Box>
    </>
  );
}
