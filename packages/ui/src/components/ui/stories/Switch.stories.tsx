import { action } from "@storybook/addon-actions";
import { useArgs } from "@storybook/preview-api";
import type { Meta, StoryObj } from "@storybook/react";

import { Switch } from "../switch";

const meta: Meta<typeof Switch> = {
  title: "Primitive/Switch",
  component: Switch,
  tags: ["autodocs"],
  argTypes: {
    checked: {
      control: "boolean",
    },
    disabled: {
      control: "boolean",
    },
    size: {
      control: { type: "radio" },
      options: ["default", "sm"],
    },
  },
  decorators: [
    (Story, context) => (
      <div className="flex">
        <Story {...context} />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    checked: false,
    size: "default",
  },
  render: (args) => {
    const [{ checked }, updateArgs] = useArgs();

    const handleCheckedChange = (next: boolean) => {
      updateArgs({ checked: next });
      action("onCheckedChange")(next);
    };

    return (
      <Switch
        {...args}
        checked={checked}
        onCheckedChange={handleCheckedChange}
      />
    );
  },
};

export const Small: Story = {
  args: {
    checked: true,
    size: "sm",
  },
  render: (args) => {
    const [{ checked }, updateArgs] = useArgs();

    const handleCheckedChange = (next: boolean) => {
      updateArgs({ checked: next });
      action("onCheckedChange")(next);
    };

    return (
      <Switch
        {...args}
        checked={checked}
        onCheckedChange={handleCheckedChange}
      />
    );
  },
};

export const Disabled: Story = {
  args: {
    checked: true,
    disabled: true,
  },
};
