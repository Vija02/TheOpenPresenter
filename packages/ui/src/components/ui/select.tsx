import { useIsMobile } from "@/lib/useIsMobile";
import { cn } from "@/lib/utils";
import { Check, ChevronDown, X } from "lucide-react";
import React, { JSX, ReactElement, Ref } from "react";
import { Control } from "react-hook-form";
import SelectComponent, {
  ClassNamesConfig,
  ClearIndicatorProps,
  DropdownIndicatorProps,
  GroupBase,
  MenuListProps,
  MenuProps,
  MultiValueRemoveProps,
  OptionProps,
  Props,
  SelectInstance,
  StylesConfig,
  components,
  createFilter,
} from "react-select";
import { FixedSizeList as List } from "react-window";

import { useDialogPortalContainerContext } from "./dialog";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "./form";

/** Select option type */
type OptionType = { label: string; value: any };

/**
 * Styles that aligns with shadcn/ui
 */
const selectStyles = {
  controlStyles: {
    base: "flex !min-h-9 w-full rounded-sm border border-stroke pl-3 py-1 pr-1 gap-1 text-sm transition-colors",
    focus: "outline-none border-ring",
    disabled: "opacity-50",
  },
  placeholderStyles: "text-secondary",
  valueContainerStyles: "gap-1",
  multiValueStyles:
    "inline-flex items-stretch gap-1 rounded-sm border border-transparent bg-surface-tertiary text-surface-tertiary-fg text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  multiValueLabelStyles: "px-1.5 py-0.5 pr-0",
  multiValueRemoveStyles:
    "cursor-pointer hover:bg-fill-destructive hover:text-fill-destructive-fg px-0.5 rounded-r-sm",
  indicatorsContainerStyles: "gap-1",
  clearIndicatorStyles: "p-1 cursor-pointer",
  indicatorSeparatorStyles: "",
  dropdownIndicatorStyles: "p-1",
  menu: "bg-surface-primary mt-1 p-1 border rounded-sm shadow-sm",
  groupHeadingStyles:
    "py-2 px-1 text-secondary-foreground text-sm font-semibold",
  optionStyles: {
    base: "hover:bg-surface-primary-hover px-2 py-1.5 rounded-sm",
    focus: "bg-surface-primary-hover",
    disabled: "opacity-50",
    selected: "bg-surface-primary-active",
  },
  noOptionsMessageStyles: "text-secondary py-4 text-center",
  label: "text-secondary text-sm",
  loadingIndicatorStyles: "flex items-center justify-center h-4 w-4 opacity-50",
  loadingMessageStyles: "text-primary p-2 bg-primary",
};

/**
 * This factory method is used to build custom classNames configuration
 */
const createClassNames = (
  classNames: ClassNamesConfig<OptionType, boolean, GroupBase<OptionType>>,
): ClassNamesConfig<OptionType, boolean, GroupBase<OptionType>> => {
  return {
    clearIndicator: (state) =>
      cn(
        selectStyles.clearIndicatorStyles,
        classNames?.clearIndicator?.(state),
      ),
    container: (state) => cn(classNames?.container?.(state)),
    control: (state) =>
      cn(
        selectStyles.controlStyles.base,
        state.isDisabled && selectStyles.controlStyles.disabled,
        state.isFocused && selectStyles.controlStyles.focus,
        classNames?.control?.(state),
      ),
    dropdownIndicator: (state) =>
      cn(
        selectStyles.dropdownIndicatorStyles,
        classNames?.dropdownIndicator?.(state),
      ),
    group: (state) => cn(classNames?.group?.(state)),
    groupHeading: (state) =>
      cn(selectStyles.groupHeadingStyles, classNames?.groupHeading?.(state)),
    indicatorsContainer: (state) =>
      cn(
        selectStyles.indicatorsContainerStyles,
        classNames?.indicatorsContainer?.(state),
      ),
    indicatorSeparator: (state) =>
      cn(
        selectStyles.indicatorSeparatorStyles,
        classNames?.indicatorSeparator?.(state),
      ),
    input: (state) => cn(classNames?.input?.(state)),
    loadingIndicator: (state) =>
      cn(
        selectStyles.loadingIndicatorStyles,
        classNames?.loadingIndicator?.(state),
      ),
    loadingMessage: (state) =>
      cn(
        selectStyles.loadingMessageStyles,
        classNames?.loadingMessage?.(state),
      ),
    menu: (state) => cn(selectStyles.menu, classNames?.menu?.(state)),
    menuList: (state) => cn(classNames?.menuList?.(state)),
    menuPortal: (state) => cn(classNames?.menuPortal?.(state)),
    multiValue: (state) =>
      cn(selectStyles.multiValueStyles, classNames?.multiValue?.(state)),
    multiValueLabel: (state) =>
      cn(
        selectStyles.multiValueLabelStyles,
        classNames?.multiValueLabel?.(state),
      ),
    multiValueRemove: (state) =>
      cn(
        selectStyles.multiValueRemoveStyles,
        classNames?.multiValueRemove?.(state),
      ),
    noOptionsMessage: (state) =>
      cn(
        selectStyles.noOptionsMessageStyles,
        classNames?.noOptionsMessage?.(state),
      ),
    option: (state) =>
      cn(
        selectStyles.optionStyles.base,
        state.isFocused && selectStyles.optionStyles.focus,
        state.isDisabled && selectStyles.optionStyles.disabled,
        state.isSelected && selectStyles.optionStyles.selected,
        classNames?.option?.(state),
      ),
    placeholder: (state) =>
      cn(selectStyles.placeholderStyles, classNames?.placeholder?.(state)),
    singleValue: (state) => cn(classNames?.singleValue?.(state)),
    valueContainer: (state) =>
      cn(
        selectStyles.valueContainerStyles,
        classNames?.valueContainer?.(state),
      ),
  };
};

const selectDefaultClassNames = createClassNames({});
const selectDefaultStyles: StylesConfig<
  OptionType,
  boolean,
  GroupBase<OptionType>
> = {
  input: (base) => ({
    ...base,
    "input:focus": {
      boxShadow: "none",
    },
  }),
  multiValueLabel: (base) => ({
    ...base,
    whiteSpace: "normal",
    overflow: "visible",
  }),
  control: (base) => ({
    ...base,
    transition: "none",
    // minHeight: '2.25rem', // we used !min-h-9 instead
  }),
  menuList: (base) => ({
    ...base,
    "::-webkit-scrollbar": {
      background: "transparent",
    },
    "::-webkit-scrollbar-track": {
      background: "transparent",
    },
    "::-webkit-scrollbar-thumb": {
      background: "hsl(var(--border))",
    },
    "::-webkit-scrollbar-thumb:hover": {
      background: "transparent",
    },
  }),
  menuPortal: (base) => ({ ...base, zIndex: 9999, pointerEvents: "auto" }),
};

/**
 * React select custom components
 */
const DropdownIndicator = (props: DropdownIndicatorProps<OptionType>) => {
  return (
    <components.DropdownIndicator {...props}>
      <ChevronDown className="h-4 w-4 opacity-50" />
    </components.DropdownIndicator>
  );
};

const ClearIndicator = (props: ClearIndicatorProps<OptionType>) => {
  return (
    <components.ClearIndicator
      {...props}
      innerProps={
        {
          ...props.innerProps,
          "data-testid": "clear-indicator",
        } as JSX.IntrinsicElements["div"]
      }
    >
      <X className="h-4 w-4 opacity-50" data-testid="testing" />
    </components.ClearIndicator>
  );
};

const MultiValueRemove = (props: MultiValueRemoveProps<OptionType>) => {
  return (
    <components.MultiValueRemove {...props}>
      <X className="h-3.5 w-3.5 opacity-50" />
    </components.MultiValueRemove>
  );
};

const Option = (props: OptionProps<OptionType>) => {
  return (
    <components.Option {...props}>
      <div className="flex items-center justify-between">
        <div>{props.children}</div>
        {props.isSelected && <Check className="h-4 w-4 opacity-50" />}
      </div>
    </components.Option>
  );
};

// Using Menu and MenuList fixes the scrolling behavior
const Menu = (props: MenuProps<OptionType>) => {
  return <components.Menu {...props}>{props.children}</components.Menu>;
};

const MenuList = (props: MenuListProps<OptionType>) => {
  const { children, maxHeight } = props;

  const childrenArray = React.Children.toArray(children);

  const calculateHeight = () => {
    // When using children it resizes correctly
    const totalHeight = childrenArray.length * 35; // Adjust item height if different
    return totalHeight < maxHeight ? totalHeight : maxHeight;
  };

  const height = calculateHeight();

  // Ensure childrenArray has length. Even when childrenArray is empty there is one element left
  if (!childrenArray || childrenArray.length - 1 === 0) {
    return <components.MenuList {...props} />;
  }
  return (
    <List
      height={height}
      itemCount={childrenArray.length}
      itemSize={35} // Adjust item height if different
      width="100%"
    >
      {({ index, style }) => <div style={style}>{childrenArray[index]}</div>}
    </List>
  );
};

const SelectParts = {
  DropdownIndicator,
  ClearIndicator,
  MultiValueRemove,
  Option,
  Menu,
  MenuList,
};

/** Past this many choices a searchable dropdown beats scrolling a native list */
const NATIVE_MAX_OPTIONS = 50;

type NativeEntry =
  | { option: OptionType; key: string }
  | { group: string; entries: { option: OptionType; key: string }[] };

const toNativeEntries = (
  props: Props<OptionType, boolean>,
): NativeEntry[] | null => {
  if (
    props.isMulti ||
    props.formatOptionLabel ||
    props.menuIsOpen !== undefined ||
    props.inputValue !== undefined ||
    (props.components && Object.keys(props.components).length > 0) ||
    !Array.isArray(props.options)
  )
    return null;

  let count = 0;
  const entries: NativeEntry[] = [];
  const toEntry = (option: unknown) => {
    const o = option as OptionType;
    if (typeof o?.label !== "string") return null;
    return { option: o, key: String(count++) };
  };
  for (const item of props.options as unknown[]) {
    const group = item as GroupBase<OptionType>;
    if (Array.isArray(group?.options)) {
      if (typeof group.label !== "string") return null;
      const children = group.options.map(toEntry);
      if (children.some((c) => !c)) return null;
      entries.push({ group: group.label, entries: children as any });
    } else {
      const entry = toEntry(item);
      if (!entry) return null;
      entries.push(entry);
    }
  }
  return count <= NATIVE_MAX_OPTIONS ? entries : null;
};

/** A single-choice select as the phone's own picker, for the same props */
const NativeSelect = ({
  props,
  entries,
}: {
  props: Props<OptionType, boolean>;
  entries: NativeEntry[];
}) => {
  const getValue = props.getOptionValue ?? ((o: OptionType) => String(o.value));
  const flat = entries.flatMap((e) => ("group" in e ? e.entries : [e]));
  const selected = props.value as OptionType | null | undefined;
  const selectedKey = selected
    ? flat.find(
        (e) =>
          e.option === selected || getValue(e.option) === getValue(selected),
      )?.key
    : undefined;

  const renderOption = ({
    option,
    key,
  }: {
    option: OptionType;
    key: string;
  }) => (
    <option
      key={key}
      value={key}
      disabled={props.isOptionDisabled?.(option, selected ? [selected] : [])}
    >
      {option.label}
    </option>
  );

  return (
    <select
      id={props.inputId ?? props.id}
      name={props.name}
      className={cn("ui--input", props.className)}
      value={selectedKey ?? ""}
      disabled={props.isDisabled}
      aria-label={props["aria-label"]}
      aria-labelledby={props["aria-labelledby"]}
      aria-describedby={
        (props as { "aria-describedby"?: string })["aria-describedby"]
      }
      aria-invalid={props["aria-invalid"]}
      onBlur={(e) =>
        props.onBlur?.(e as unknown as React.FocusEvent<HTMLInputElement>)
      }
      onFocus={(e) =>
        props.onFocus?.(e as unknown as React.FocusEvent<HTMLInputElement>)
      }
      onChange={(e) => {
        const option = flat.find((x) => x.key === e.target.value)?.option;
        if (option) {
          props.onChange?.(option as any, {
            action: "select-option",
            option,
            name: props.name,
          });
        } else {
          props.onChange?.(null as any, {
            action: "clear",
            removedValues: selected ? [selected] : [],
            name: props.name,
          });
        }
      }}
    >
      {/* Empty choice: removes the value when clearable, else only a prompt */}
      {(props.isClearable || selectedKey === undefined) && (
        <option value="" disabled={!props.isClearable}>
          {typeof props.placeholder === "string"
            ? props.placeholder
            : "Select…"}
        </option>
      )}
      {entries.map((e) =>
        "group" in e ? (
          <optgroup key={e.group} label={e.group}>
            {e.entries.map(renderOption)}
          </optgroup>
        ) : (
          renderOption(e)
        ),
      )}
    </select>
  );
};

const BaseSelect = <IsMulti extends boolean = false>(
  props: Props<OptionType, IsMulti> & { isMulti?: IsMulti },
  ref: React.Ref<SelectInstance<OptionType, IsMulti, GroupBase<OptionType>>>,
) => {
  const { styles, classNames, components = {}, ...rest } = props;
  const instanceId = React.useId();
  const container = useDialogPortalContainerContext();
  const isMobile = useIsMobile();

  // Phones get their own picker when the choices are plain text
  const nativeEntries = isMobile
    ? toNativeEntries(props as Props<OptionType, boolean>)
    : null;
  if (nativeEntries) {
    return (
      <NativeSelect
        props={props as Props<OptionType, boolean>}
        entries={nativeEntries}
      />
    );
  }

  return (
    <SelectComponent<OptionType, IsMulti, GroupBase<OptionType>>
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

const Select = React.forwardRef(BaseSelect) as <
  IsMulti extends boolean = false,
>(
  p: Props<OptionType, IsMulti> & {
    ref?: Ref<SelectInstance<OptionType, IsMulti, GroupBase<OptionType>>>;
    isMulti?: IsMulti;
  },
) => ReactElement;

function SelectControl<IsMulti extends boolean = false>({
  control,
  name,
  label,
  description,
  options,
  ...props
}: Omit<Props<OptionType, IsMulti>, "options"> & {
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
            <Select
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

export {
  Select,
  SelectControl,
  type OptionType,
  SelectParts,
  selectDefaultClassNames,
  selectDefaultStyles,
};
