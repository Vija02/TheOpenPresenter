import { Box, Text } from "@chakra-ui/react";

type PropTypes = {
  heading?: string;
  headingIsFaded?: boolean;
  isActive?: boolean;
  aspectRatio?: number;
  onClick?: () => void;
  children?: React.ReactNode;
};

export const Slide = ({
  heading,
  headingIsFaded,
  isActive,
  aspectRatio = 16 / 9,
  onClick,
  children,
}: PropTypes) => {
  return (
    <Box cursor={onClick ? "pointer" : "auto"} onClick={onClick}>
      {heading && (
        <Text
          fontWeight={headingIsFaded ? "normal" : "bold"}
          textTransform="uppercase"
          fontSize="xs"
          mb={1}
          color={headingIsFaded ? "gray.600" : "inherit"}
        >
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
