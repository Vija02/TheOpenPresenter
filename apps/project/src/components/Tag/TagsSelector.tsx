import { useOrganizationSlug } from "@/lib/permissionHooks/organization";
import { CreatableSelect, Link } from "@repo/ui";
import { FiSettings } from "react-icons/fi";
import { Props } from "react-select";
import { CreatableProps } from "react-select/creatable";
import { Link as WouterLink } from "wouter";

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
    <div data-testid="tag-selector">
      <CreatableSelect
        {...ReactSelectTagsProps()}
        isMulti
        onCreateOption={onCreateOption}
        value={value}
        onChange={onChange}
        isDisabled={disabled}
      />
    </div>
  );
}

export function TagSettingsPrompt() {
  const slug = useOrganizationSlug();

  return (
    <Link
      variant="unstyled"
      className="block h-full hover:bg-surface-secondary-hover transition-colors ease-in-out w-full"
      asChild
    >
      <WouterLink href={`/o/${slug}/settings/tags`}>
        <div className="stack-row justify-center py-1">
          <FiSettings className="text-secondary text-[13px]" />
          <p className="text-secondary text-xs">Tag Settings</p>
        </div>
      </WouterLink>
    </Link>
  );
}
