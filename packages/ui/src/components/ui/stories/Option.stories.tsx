import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";

import { Option } from "../option";

const meta = {
  title: "Primitive/Option",
  component: Option,
  tags: ["autodocs"],
  argTypes: {
    size: {
      control: { type: "select" },
      options: ["default", "sm", "lg"],
    },
  },
  args: {
    title: "Auto fit",
    description: "Fit your lyrics in the available space",
    selected: false,
    onClick: fn(),
    size: "default",
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

export const Size: Story = {
  render: () => (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium mb-2">Small</h3>
        <Option
          title="Small option"
          description="This is a small sized option"
          size="sm"
          selected={false}
        />
      </div>
      <div>
        <h3 className="text-sm font-medium mb-2">Default</h3>
        <Option
          title="Default option"
          description="This is a default sized option"
          size="default"
          selected={false}
        />
      </div>
      <div>
        <h3 className="text-sm font-medium mb-2">Large</h3>
        <Option
          title="Large option"
          description="This is a large sized option"
          size="lg"
          selected={false}
        />
      </div>
    </div>
  ),
};
