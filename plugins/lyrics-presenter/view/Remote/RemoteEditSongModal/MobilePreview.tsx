import { Box, Button, Show, Text } from "@chakra-ui/react";
import { useWindowWidth } from "@react-hook/window-size";
import { MotionBox, SlideGrid } from "@repo/ui";
import { useMemo, useState } from "react";
import { FaChevronUp } from "react-icons/fa6";

export const MobilePreview = ({ preview }: { preview: React.ReactNode }) => {
  const [previewOpen, setPreviewOpen] = useState(false);
  const windowWidth = useWindowWidth();

  const width = useMemo(() => {
    if (windowWidth > 550) {
      return windowWidth / 2 - 40;
    }
    return Math.min(380, windowWidth - 40);
  }, [windowWidth]);

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
          overflow="auto"
        >
          <SlideGrid forceWidth={width}>{preview}</SlideGrid>
        </MotionBox>
      </Show>
    </Box>
  );
};
