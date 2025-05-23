import type { Meta, StoryObj } from "@storybook/react";

import { Badge } from "../badge";

const meta = {
  title: "Primitive/Badge",
  component: Badge,
  tags: ["autodocs"],
  argTypes: {},
  args: { children: "Badge" },
} satisfies Meta<typeof Badge>;

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
