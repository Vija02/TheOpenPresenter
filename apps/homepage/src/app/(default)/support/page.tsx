import { StandardWidth } from "@/components/StandardWidth";
import { css } from "@/styled-system/css";
import { Box, VStack } from "@/styled-system/jsx";
import NextLink from "next/link";

export default function Support() {
  return (
    <StandardWidth>
      <VStack pt={{ base: 24, md: 28 }}>
        <h1 className={css({ textStyle: "heading" })}>Support</h1>
        <Box textAlign="center" maxW="500px" textStyle="body">
          Need help or have questions? Email us at{" "}
          <NextLink
            href="mailto:support@theopenpresenter.com"
            className={css({ textStyle: "link" })}
          >
            support@theopenpresenter.com
          </NextLink>
        </Box>
      </VStack>
    </StandardWidth>
  );
}
