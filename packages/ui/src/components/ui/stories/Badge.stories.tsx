import type { Meta, StoryObj } from "@storybook/react";

import { Badge } from "../badge";

const meta = {
  title: "Primitive/Badge",
  component: Badge,
  tags: ["autodocs"],
  argTypes: {
    size: {
      control: { type: "select" },
      options: ["default", "sm", "lg"],
    },
  },
  args: {
    children: "Badge",
    size: "default",
  },
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

export const VariantAndSize: Story = {
  render: () => (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium mb-2">Small Size</h3>
        <div className="flex gap-2">
          <Badge variant="default" size="sm">
            Default
          </Badge>
          <Badge variant="success" size="sm">
            Success
          </Badge>
          <Badge variant="destructive" size="sm">
            Error
          </Badge>
          <Badge variant="info" size="sm">
            Info
          </Badge>
          <Badge variant="warning" size="sm">
            Warning
          </Badge>
        </div>
      </div>
      <div>
        <h3 className="text-sm font-medium mb-2">Default Size</h3>
        <div className="flex gap-2">
          <Badge variant="default" size="default">
            Default
          </Badge>
          <Badge variant="success" size="default">
            Success
          </Badge>
          <Badge variant="destructive" size="default">
            Error
          </Badge>
          <Badge variant="info" size="default">
            Info
          </Badge>
          <Badge variant="warning" size="default">
            Warning
          </Badge>
        </div>
      </div>
      <div>
        <h3 className="text-sm font-medium mb-2">Large Size</h3>
        <div className="flex gap-2">
          <Badge variant="default" size="lg">
            Default
          </Badge>
          <Badge variant="success" size="lg">
            Success
          </Badge>
          <Badge variant="destructive" size="lg">
            Error
          </Badge>
          <Badge variant="info" size="lg">
            Info
          </Badge>
          <Badge variant="warning" size="lg">
            Warning
          </Badge>
        </div>
      </div>
    </div>
  ),
};
