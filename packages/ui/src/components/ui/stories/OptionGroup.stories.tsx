import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";

import { OptionGroup } from "../option";

const sampleOptions = [
  {
    title: "Auto fit",
    description: "Fit your lyrics in the available space",
    value: "auto",
  },
  {
    title: "Manual",
    description: "Manually set the size of your fonts",
    value: "manual",
  },
  {
    title: "Custom",
    description: "Use custom sizing rules",
    value: "custom",
  },
];

const sampleOptionsWithDisabled = [
  {
    title: "Auto fit",
    description: "Fit your lyrics in the available space",
    value: "auto",
  },
  {
    title: "Manual",
    description: "Manually set the size of your fonts",
    value: "manual",
    disabled: true,
  },
  {
    title: "Custom",
    description: "Use custom sizing rules",
    value: "custom",
  },
];

const meta = {
  title: "Primitive/OptionGroup",
  component: OptionGroup,
  tags: ["autodocs"],
  argTypes: {
    size: {
      control: { type: "select" },
      options: ["default", "sm", "lg"],
    },
  },
  args: {
    options: sampleOptions,
    size: "default",
  },
} satisfies Meta<typeof OptionGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => {
    const [value, setValue] = React.useState("auto");

    return (
      <OptionGroup<string>
        options={(args.options as typeof sampleOptions) || sampleOptions}
        value={value}
        onValueChange={setValue}
        disabled={args.disabled}
        className={args.className}
        size={args.size}
      />
    );
  },
};

export const Disabled: Story = {
  args: {
    options: sampleOptions,
    disabled: true,
  },
  render: (args) => {
    const [value, setValue] = React.useState("auto");

    return (
      <OptionGroup<string>
        options={(args.options as typeof sampleOptions) || sampleOptions}
        value={value}
        onValueChange={setValue}
        disabled={args.disabled}
        className={args.className}
        size={args.size}
      />
    );
  },
};

export const PartialDisabled: Story = {
  args: { options: sampleOptionsWithDisabled },
  render: (args) => {
    const [value, setValue] = React.useState("auto");

    return (
      <OptionGroup<string>
        options={
          (args.options as typeof sampleOptionsWithDisabled) ||
          sampleOptionsWithDisabled
        }
        value={value}
        onValueChange={setValue}
        disabled={args.disabled}
        className={args.className}
        size={args.size}
      />
    );
  },
};

export const Size: Story = {
  render: () => {
    const [valueSmall, setValueSmall] = React.useState("auto");
    const [valueDefault, setValueDefault] = React.useState("auto");
    const [valueLarge, setValueLarge] = React.useState("auto");

    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-sm font-medium mb-2">Small Size</h3>
          <OptionGroup
            options={sampleOptions}
            value={valueSmall}
            onValueChange={setValueSmall}
            size="sm"
          />
        </div>
        <div>
          <h3 className="text-sm font-medium mb-2">Default Size</h3>
          <OptionGroup
            options={sampleOptions}
            value={valueDefault}
            onValueChange={setValueDefault}
            size="default"
          />
        </div>
        <div>
          <h3 className="text-sm font-medium mb-2">Large Size</h3>
          <OptionGroup
            options={sampleOptions}
            value={valueLarge}
            onValueChange={setValueLarge}
            size="lg"
          />
        </div>
      </div>
    );
  },
};
