import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";

import { Button } from "../button";

const meta = {
  title: "Primitive/Button",
  component: Button,
  tags: ["autodocs"],
  argTypes: {},
  args: {
    onClick: fn(),
    children: "Confirm",
    isLoading: false,
    size: "default",
  },
} satisfies Meta<typeof Button>;

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
export const Outline: Story = {
  args: {
    variant: "outline",
  },
};
export const Muted: Story = {
  args: {
    variant: "muted",
  },
};
export const Ghost: Story = {
  args: {
    variant: "ghost",
  },
};
export const Link: Story = {
  args: {
    variant: "link",
  },
};
