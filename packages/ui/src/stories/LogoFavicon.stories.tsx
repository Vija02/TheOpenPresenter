import type { Meta, StoryObj } from "@storybook/react";

import { LogoFavicon } from "../LogoFavicon";

const meta = {
  title: "Brand/LogoFavicon",
  component: LogoFavicon,
  tags: ["autodocs"],
  argTypes: {
    width: {
      control: { type: "text" },
      description: "Width of the logo",
    },
    height: {
      control: { type: "text" },
      description: "Height of the logo",
    },
  },
} satisfies Meta<typeof LogoFavicon>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Small: Story = {
  args: {
    width: 32,
    height: 24,
  },
};

export const Medium: Story = {
  args: {
    width: 64,
    height: 48,
  },
};

export const Large: Story = {
  args: {
    width: 128,
    height: 96,
  },
};
