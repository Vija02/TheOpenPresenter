import React, { useCallback } from "react";
import ReactCalendar from "react-calendar";
import {
  GroupBase,
  MenuListProps,
  Options,
  Props,
  SelectComponentsConfig,
  StylesConfig,
} from "react-select";

const MenuList = (props: MenuListProps<any, any>) => {
  const onChange = useCallback(
    (val: Date) => {
      if (props.selectProps.onChange) {
        props.selectProps?.onChange(val, {
          // This doesn't do anything but the function wants it
          action: "select-option",
          option: { value: val, label: "" },
          name: "",
        });
        if (props.selectProps.onMenuClose) {
          props.selectProps.onMenuClose();
        }
      }
    },
    [props.selectProps],
  );

  return (
    <ReactCalendar
      value={props.selectProps.value?.value}
      onChange={(val) => onChange(val as Date)}
    />
  );
};

export const ReactSelectDateComponents: SelectComponentsConfig<
  Options<any>,
  true,
  any
> = { MenuList };

export const ReactSelectDateStyle: Partial<
  StylesConfig<any, any, GroupBase<any>>
> = {
  container: (provided) => ({ ...provided, width: "100%" }),
  menu: (provided) => ({ ...provided, width: 350, right: 0 }),
};

export const ReactSelectDateProps: Props<any, any> = {
  styles: ReactSelectDateStyle,
  components: ReactSelectDateComponents,
};
