import { Tag as ChakraTag, Flex, Text, Tooltip } from "@chakra-ui/react";
import { TagFragment } from "@repo/graphql";
import React from "react";
import { FiX } from "react-icons/fi";

import useCalculatedColor from "./useCalculatedColor";

export type TagPropTypes = {
  tag: Pick<
    TagFragment,
    "name" | "description" | "backgroundColor" | "foregroundColor" | "variant"
  >;
  placeholder?: string;
  showRemove?: boolean;
  onRemove?: React.MouseEventHandler<HTMLDivElement>;
};

export function Tag({
  tag,
  placeholder = "",
  showRemove = false,
  onRemove,
}: TagPropTypes) {
  const { name, description, backgroundColor, foregroundColor, variant } = tag;

  const {
    backgroundColor: calculatedBackgroundColor,
    foregroundColor: calculatedForegroundColor,
  } = useCalculatedColor(backgroundColor, foregroundColor);

  return (
    <Tooltip label={description}>
      <ChakraTag
        size="xs"
        borderRadius="sm"
        backgroundColor={variant === "outline" ? "" : calculatedBackgroundColor}
        borderColor={calculatedBackgroundColor}
        borderWidth={variant === "outline" ? 1 : 0}
        rounded="sm"
        boxShadow="none"
        variant={(variant as any) ?? "solid"}
        paddingX={0}
        alignItems="normal"
      >
        <Flex alignItems="center" overflow="hidden">
          <Text
            px={2}
            py={1}
            color={calculatedForegroundColor}
            whiteSpace="nowrap"
            textOverflow="ellipsis"
            fontSize="xs"
            overflow="hidden"
          >
            {!!name && name !== "" ? name : placeholder}
          </Text>
        </Flex>
        {showRemove && (
          <Flex
            alignItems="center"
            _hover={{ backgroundColor: "black", opacity: 0.3 }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={onRemove}
            px={2}
            alignSelf="normal"
          >
            <FiX color={calculatedForegroundColor} />
          </Flex>
        )}
      </ChakraTag>
    </Tooltip>
  );
}
