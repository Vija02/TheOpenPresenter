import React, { ReactElement, Ref } from "react";
import { Control } from "react-hook-form";
import { GroupBase, SelectInstance, createFilter } from "react-select";
import CreatableSelectComponent, {
  CreatableProps,
} from "react-select/creatable";

import { useDialogPortalContainerContext } from "./dialog";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "./form";
import {
  OptionType,
  SelectParts,
  selectDefaultClassNames,
  selectDefaultStyles,
} from "./select";

const BaseCreatableSelect = <IsMulti extends boolean = false>(
  props: CreatableProps<OptionType, IsMulti, GroupBase<OptionType>> & {
    isMulti?: IsMulti;
  },
  ref: React.Ref<SelectInstance<OptionType, IsMulti, GroupBase<OptionType>>>,
) => {
  const { styles, classNames, components = {}, ...rest } = props;
  const instanceId = React.useId();
  const container = useDialogPortalContainerContext();

  return (
    <CreatableSelectComponent<OptionType, IsMulti, GroupBase<OptionType>>
      ref={ref}
      instanceId={instanceId}
      unstyled
      filterOption={createFilter({
        matchFrom: "any",
        stringify: (option) => option.label,
      })}
      menuPortalTarget={
        container ?? (typeof window !== "undefined" ? document.body : undefined)
      }
      components={{
        ...SelectParts,
        ...components,
      }}
      styles={{ ...selectDefaultStyles, ...styles }}
      classNames={{ ...selectDefaultClassNames, ...classNames }}
      {...rest}
    />
  );
};

const CreatableSelect = React.forwardRef(BaseCreatableSelect) as <
  IsMulti extends boolean = false,
>(
  p: CreatableProps<OptionType, IsMulti, GroupBase<OptionType>> & {
    ref?: Ref<SelectInstance<OptionType, IsMulti, GroupBase<OptionType>>>;
    isMulti?: IsMulti;
  },
) => ReactElement;

function CreatableSelectControl<IsMulti extends boolean = false>({
  control,
  name,
  label,
  description,
  options,
  ...props
}: Omit<
  CreatableProps<OptionType, IsMulti, GroupBase<OptionType>>,
  "options"
> & {
  name: string;
  label: string;
  description?: string;
  control: Control<any, any, any>;
  options: OptionType[];
  isMulti?: IsMulti;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <CreatableSelect
              {...field}
              {...props}
              options={options}
              value={
                field.value !== undefined && field.value !== null
                  ? props.isMulti
                    ? options.filter((option) =>
                        Array.isArray(field.value)
                          ? field.value.includes(option.value)
                          : false,
                      )
                    : options.find((option) => option.value === field.value)
                  : props.isMulti
                    ? []
                    : null
              }
              onChange={(selectedOption) => {
                if (props.isMulti) {
                  const values = Array.isArray(selectedOption)
                    ? selectedOption.map((option) => option.value)
                    : [];
                  field.onChange(values);
                } else {
                  const value = selectedOption
                    ? (selectedOption as OptionType).value
                    : null;
                  field.onChange(value);
                }
              }}
            />
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export { CreatableSelect, CreatableSelectControl };
