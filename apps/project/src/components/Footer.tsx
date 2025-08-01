import { Box, Flex, HStack, Link, Text, VStack } from "@chakra-ui/react";
import { companyName } from "@repo/config";
import { Logo } from "@repo/ui";
import React from "react";
import { Link as WouterLink } from "wouter";

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
            <Link
              as={WouterLink}
              href="/support"
              color="white"
              variant="footer"
            >
              Support
            </Link>
            <Link
              as={WouterLink}
              href="/privacy"
              color="white"
              variant="footer"
            >
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
                CONTACT
              </Text>
              <VStack alignItems="flex-start" spacing={1}>
                <Link
                  as={WouterLink}
                  href="mailto:support@theopenpresenter.com"
                  fontSize="md"
                  fontWeight="500"
                  variant="footer"
                >
                  Email
                </Link>
                <Link
                  as={WouterLink}
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
