import type { Meta, StoryObj } from "@storybook/react";

import { Progress } from "../progress";

const meta = {
  title: "Primitive/Progress",
  component: Progress,
  tags: ["autodocs"],
  argTypes: {},
  args: { value: 40 },
} satisfies Meta<typeof Progress>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    variant: "default",
  },
};
export const Success: Story = {
  args: {
    variant: "success",
  },
};
export const Destructive: Story = {
  args: {
    variant: "destructive",
  },
};
export const Info: Story = {
  args: {
    variant: "info",
  },
};
export const Warning: Story = {
  args: {
    variant: "warning",
  },
};
