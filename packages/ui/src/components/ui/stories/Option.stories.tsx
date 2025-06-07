import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";

import { Option } from "../option";

const meta = {
  title: "Primitive/Option",
  component: Option,
  tags: ["autodocs"],
  argTypes: {},
  args: {
    title: "Auto fit",
    description: "Fit your lyrics in the available space",
    selected: false,
    onClick: fn(),
  },
} satisfies Meta<typeof Option>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: "Auto fit",
    description: "Fit your lyrics in the available space",
    selected: false,
  },
};

export const Selected: Story = {
  args: {
    title: "Auto fit",
    description: "Fit your lyrics in the available space",
    selected: true,
  },
};

export const WithoutDescription: Story = {
  args: {
    title: "Simple option",
    description: undefined,
    selected: false,
  },
};

export const Disabled: Story = {
  args: {
    title: "Disabled option",
    description: "This option cannot be selected",
    disabled: true,
    selected: false,
  },
};

export const DisabledSelected: Story = {
  args: {
    title: "Disabled selected option",
    description: "This option is selected but disabled",
    disabled: true,
    selected: true,
  },
};
