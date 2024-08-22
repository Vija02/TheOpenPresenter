import { Box, Flex, HStack, Link, Text, VStack } from "@chakra-ui/react";
import { companyName } from "@repo/config";
import { Logo } from "@repo/ui";
import NextLink from "next/link";
import React from "react";

import { StandardWidth } from "./StandardWidth";

// TODO: All these pages
export function Footer() {
  return (
    <Box p={4} bgColor="#1F252A">
      <StandardWidth>
        <Flex
          justifyContent="space-between"
          w="100%"
          flexDirection={["column", "row"]}
          gap={10}
        >
          <VStack alignItems="flex-start" spacing={0}>
            <Logo height={40} />
            <Box pb={5} />
            <Text color="white">
              &copy; {new Date().getFullYear()} {companyName}
            </Text>
            <Link as={NextLink} href="/support" color="white" variant="footer">
              Support
            </Link>
            <Link as={NextLink} href="/privacy" color="white" variant="footer">
              Privacy Policy
            </Link>
          </VStack>
          <HStack spacing={14} alignItems="flex-start">
            <Flex flexDir="column" alignItems="flex-start">
              <Text
                textAlign="end"
                fontSize="lg"
                color="white"
                mb={4}
                fontWeight="bold"
              >
                LINKS
              </Text>
              <VStack alignItems="flex-start" spacing={1}>
                <Link
                  as={NextLink}
                  href="/about"
                  fontSize="md"
                  fontWeight="500"
                  variant="footer"
                >
                  About
                </Link>
              </VStack>
            </Flex>
            <Flex flexDir="column" alignItems="flex-start">
              <Text
                textAlign="end"
                fontSize="lg"
                color="white"
                mb={4}
                fontWeight="bold"
              >
                CONTACT
              </Text>
              <VStack alignItems="flex-start" spacing={1}>
                <Link
                  as={NextLink}
                  href="mailto:support@theopenpresenter.com"
                  fontSize="md"
                  fontWeight="500"
                  variant="footer"
                >
                  Email
                </Link>
                <Link
                  as={NextLink}
                  href="/support"
                  fontSize="md"
                  fontWeight="500"
                  variant="footer"
                >
                  Support
                </Link>
              </VStack>
            </Flex>
          </HStack>
        </Flex>
      </StandardWidth>
    </Box>
  );
}
