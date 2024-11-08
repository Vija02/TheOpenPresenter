import { useOrganizationSlug } from "@/lib/permissionHooks/organization";
import {
  HStack,
  LinkBox,
  LinkOverlay,
  Text,
  VStack,
  chakra,
} from "@chakra-ui/react";
import React from "react";
import { FiSettings } from "react-icons/fi";
import { MultiValue, Props } from "react-select";
import CreatableSelect, { CreatableProps } from "react-select/creatable";

import { ReactSelectTagsProps } from "./tagReactSelect";

type PropTypes = {
  onCreateOption: CreatableProps<any, true, any>["onCreateOption"];
  value: { value: any; label: string }[];
  onChange: Props<any, any>["onChange"];
  disabled?: boolean;
};

export function TagsSelector({
  onCreateOption,
  value,
  onChange,
  disabled,
}: PropTypes) {
  return (
    <CreatableSelect
      {...ReactSelectTagsProps()}
      isMulti
      onCreateOption={onCreateOption}
      value={value}
      onChange={onChange}
      isDisabled={disabled}
    />
  );
}

const SettingsIcon = chakra(FiSettings);

export function TagSettingsPrompt() {
  const slug = useOrganizationSlug();

  return (
    <LinkBox
      height="100%"
      _hover={{ backgroundColor: "gray.100" }}
      transition="ease"
    >
      <HStack py={1} justifyContent="center" alignItems="center">
        <SettingsIcon color="subtitle" fontSize={13} />
        <LinkOverlay
          color="subtitle"
          fontSize="xs"
          href={`/o/${slug}/settings/tags`}
        >
          Tag Settings
        </LinkOverlay>
      </HStack>
    </LinkBox>
  );
}
