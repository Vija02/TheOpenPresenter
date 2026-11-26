import { useOrganizationSlug } from "@/lib/permissionHooks/organization";
import { CreatableSelect } from "@repo/ui";
import { FiSettings } from "react-icons/fi";
import { Props } from "react-select";
import { CreatableProps } from "react-select/creatable";

import "./TagsSelector.css";
import { ReactSelectTagsProps } from "./tagReactSelect";

type PropTypes = {
  onCreateOption: CreatableProps<any, true, any>["onCreateOption"];
  value: { value: any; label: string }[];
  onChange: Props<any, any>["onChange"];
  disabled?: boolean;
  /** No box or arrows, so it reads as part of the form */
  inline?: boolean;
  autoFocus?: boolean;
  onBlur?: () => void;
  "aria-label"?: string;
};

const Nothing = () => null;

export function TagsSelector({
  onCreateOption,
  value,
  onChange,
  disabled,
  inline,
  autoFocus,
  onBlur,
  "aria-label": ariaLabel,
}: PropTypes) {
  const selectProps = ReactSelectTagsProps();
  return (
    <div
      data-testid="tag-selector"
      className={inline ? "min-w-0 flex-1" : undefined}
    >
      <CreatableSelect
        {...selectProps}
        {...(inline && {
          components: {
            ...selectProps.components,
            DropdownIndicator: Nothing,
            IndicatorSeparator: Nothing,
            ClearIndicator: Nothing,
          },
          classNames: { control: () => "project--tags-inline__control" },
          placeholder: "Search or create a tag…",
        })}
        autoFocus={autoFocus}
        openMenuOnFocus={autoFocus}
        onBlur={onBlur}
        aria-label={ariaLabel}
        isMulti
        onCreateOption={onCreateOption}
        value={value}
        onChange={onChange}
        isDisabled={disabled}
      />
    </div>
  );
}

export function TagSettingsPrompt({ size = "sm" }: { size?: "sm" | "lg" }) {
  const slug = useOrganizationSlug();

  return (
    <a
      href={`/o/${slug}/settings/tags`}
      target="_blank"
      rel="noreferrer"
      className="block h-full w-full transition-colors ease-in-out hover:bg-surface-secondary-hover hover:no-underline"
    >
      <div
        className={`stack-row justify-center ${size === "lg" ? "py-3" : "py-1"}`}
      >
        <FiSettings className="text-secondary text-[13px]" />
        <p className="text-secondary text-xs">Tag Settings</p>
      </div>
    </a>
  );
}
