import { Box, Button, Grid, Show, Text } from "@chakra-ui/react";
import { MotionBox } from "@repo/ui";
import { useState } from "react";
import { FaChevronUp } from "react-icons/fa6";

export const MobilePreview = ({ preview }: { preview: React.ReactNode }) => {
  const [previewOpen, setPreviewOpen] = useState(false);

  return (
    <Box borderBottom="1px solid rgb(0,0,0,0.1)">
      <Button
        display={{ base: "flex", md: "none" }}
        gap={2}
        variant="ghost"
        borderRadius={0}
        onClick={() => setPreviewOpen((prev) => !prev)}
        width="100%"
      >
        <Text>Preview </Text>{" "}
        <FaChevronUp
          style={{
            transform: previewOpen ? "rotate(180deg)" : "",
          }}
          fontSize={14}
        />
      </Button>
      <Show below="md">
        <MotionBox
          initial="close"
          variants={{
            open: { height: "30vh" },
            close: { height: "0vh" },
          }}
          animate={previewOpen ? "open" : "close"}
          overflow="hidden"
        >
          <Grid
            maxHeight="30vh"
            overflow="auto"
            px={3}
            gridTemplateColumns="repeat(auto-fill, minmax(200px, 1fr))"
          >
            {preview}
          </Grid>
        </MotionBox>
      </Show>
    </Box>
  );
};
