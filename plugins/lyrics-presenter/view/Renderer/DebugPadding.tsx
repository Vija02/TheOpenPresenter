import { Box } from "@chakra-ui/react";

export const DebugPadding = ({
  padding,
}: {
  padding: [number, number, number, number];
}) => {
  return (
    <>
      <Box
        position="absolute"
        left={0}
        top={0}
        bottom={0}
        width={`${padding[0]}px`}
        bg="#5042B2"
      />
      <Box
        position="absolute"
        top={0}
        left={0}
        right={0}
        height={`${padding[1]}px`}
        bg="#5042B2"
      />
      <Box
        position="absolute"
        right={0}
        top={0}
        bottom={0}
        width={`${padding[2]}px`}
        bg="#5042B2"
      />
      <Box
        position="absolute"
        bottom={0}
        left={0}
        right={0}
        height={`${padding[3]}px`}
        bg="#5042B2"
      />
    </>
  );
};
