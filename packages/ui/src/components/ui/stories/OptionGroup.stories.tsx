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
  argTypes: {},
  args: {
    options: sampleOptions,
  },
} satisfies Meta<typeof OptionGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OptionGroupStory: Story = {
  render: (args) => {
    const [value, setValue] = React.useState("auto");

    return <OptionGroup {...args} value={value} onValueChange={setValue} />;
  },
};

export const OptionGroupWithDisabled: Story = {
  args: { disabled: true },
  render: (args) => {
    const [value, setValue] = React.useState("auto");

    return <OptionGroup {...args} value={value} onValueChange={setValue} />;
  },
};

export const OptionGroupWithPartialDisabled: Story = {
  args: { options: sampleOptionsWithDisabled },
  render: (args) => {
    const [value, setValue] = React.useState("auto");

    return <OptionGroup {...args} value={value} onValueChange={setValue} />;
  },
};
