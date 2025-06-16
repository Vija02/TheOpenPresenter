import type { Meta, StoryObj } from "@storybook/react";

import { Logo } from "../Logo";

const meta = {
  title: "Brand/Logo",
  component: Logo,
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
} satisfies Meta<typeof Logo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Small: Story = {
  args: {
    width: 200,
    height: 57,
  },
  render: (args) => {
    return (
      <div className="bg-black p-4">
        <Logo {...args} />
      </div>
    );
  },
};

export const Medium: Story = {
  args: {
    width: 300,
    height: 86,
  },
  render: (args) => {
    return (
      <div className="bg-black p-4">
        <Logo {...args} />
      </div>
    );
  },
};

export const Large: Story = {
  args: {
    width: 500,
    height: 143,
  },
  render: (args) => {
    return (
      <div className="bg-black p-4">
        <Logo {...args} />
      </div>
    );
  },
};
