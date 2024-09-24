import { Box, Text } from "@chakra-ui/react";

type PropTypes = {
  heading?: string;
  isActive?: boolean;
  aspectRatio?: number;
  onClick?: () => void;
  children?: React.ReactNode;
};

export const Slide = ({
  heading,
  isActive,
  aspectRatio = 16 / 9,
  onClick,
  children,
}: PropTypes) => {
  return (
    <Box cursor="pointer" onClick={onClick}>
      {heading && (
        <Text fontWeight="bold" textTransform="uppercase" fontSize="xs" mb={1}>
          {heading}
        </Text>
      )}
      <Box
        aspectRatio={aspectRatio}
        w="200px"
        borderWidth="4px"
        borderColor={isActive ? "red.600" : "transparent"}
        userSelect="none"
      >
        {children}
      </Box>
    </Box>
  );
};
