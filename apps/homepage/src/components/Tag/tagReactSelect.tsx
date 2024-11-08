import { globalState } from "@repo/lib";
import React from "react";
import {
  GroupBase,
  MenuListProps,
  MultiValueGenericProps,
  Options,
  Props,
  SelectComponentsConfig,
  StylesConfig,
  components,
} from "react-select";

import { Tag } from ".";
import { TagSettingsPrompt } from "./TagsSelector";

const MultiValueContainer = (props: MultiValueGenericProps<any, true>) => {
  return (
    <Tag
      tag={props.data.value}
      showRemove
      onRemove={(e) => {
        e.stopPropagation();
        if (props.selectProps.onChange) {
          props.selectProps.onChange(
            props.selectProps.value.filter(
              (option: any) => option.value.id !== props.data.value.id,
            ),
            {
              // This doesn't do anything but the function wants it
              action: "deselect-option",
              option: { value: {}, label: "" },
              name: "",
            },
          );
        }
      }}
    />
  );
};

const MenuList = (props: MenuListProps<any, true>) => {
  return (
    <components.MenuList {...props}>
      {props.children}
      <TagSettingsPrompt />
    </components.MenuList>
  );
};

export const ReactSelectTagsComponents: SelectComponentsConfig<
  Options<any>,
  true,
  any
> = { MenuList, MultiValueContainer };

export const ReactSelectTagsStyle: Partial<
  StylesConfig<any, any, GroupBase<any>>
> = {
  container: (provided) => ({ ...provided, width: "100%" }),
};

export const ReactSelectTagsProps = () => {
  const { allTagByOrganization, allTagByOrganizationQueryResult } =
    globalState.modelDataAccess.useTag();
  const loading = allTagByOrganizationQueryResult?.loading;

  return {
    components: ReactSelectTagsComponents,
    styles: ReactSelectTagsStyle,
    getOptionValue: (option) => option.value.id,
    formatOptionLabel: function formatOptionLabelComponent(props) {
      if (props.__isNew__) {
        return props.label;
      }
      return <Tag tag={props.value} />;
    },
    isLoading: loading && !allTagByOrganization,
    options: allTagByOrganization?.map((x) => ({
      value: x,
      label: x.name,
    })),
    noOptionsMessage: () => "No tags found. Start typing to create one",
  } as Props<any, true>;
};
