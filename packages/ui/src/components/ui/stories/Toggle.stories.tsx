import type { Meta, StoryObj } from "@storybook/react";
import { Heart, Settings, Star, Volume2 } from "lucide-react";
import { useForm } from "react-hook-form";

import { Form } from "../form";
import { Toggle, ToggleControl } from "../toggle";

const meta: Meta<typeof Toggle> = {
  title: "Primitive/Toggle",
  component: Toggle,
  tags: ["autodocs"],
  argTypes: {
    size: {
      control: { type: "select" },
      options: ["default", "sm", "lg"],
    },
    disabled: {
      control: { type: "boolean" },
    },
  },
};

export default meta;

type Story = StoryObj<typeof Toggle>;

export const Default: Story = {
  args: {
    children: <Heart className="size-4" />,
  },
};

export const Small: Story = {
  args: {
    size: "sm",
    children: <Star className="size-3" />,
  },
};

export const Large: Story = {
  args: {
    size: "lg",
    children: <Settings className="size-4" />,
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    children: <Volume2 className="size-4" />,
  },
};

export const WithText: Story = {
  args: {
    children: (
      <>
        <Heart className="size-4" />
        Favorite
      </>
    ),
  },
};

export const WithFormControl: Story = {
  render: (args: any) => {
    const form = useForm({
      defaultValues: {
        notifications: false,
        darkMode: true,
      },
    });

    return (
      <Form {...form}>
        <form className="space-y-4">
          <ToggleControl
            control={form.control}
            name="notifications"
            label="Enable Notifications"
            description="Receive notifications about important updates"
            {...args}
          >
            <Volume2 className="size-4" />
          </ToggleControl>
          <ToggleControl
            control={form.control}
            name="darkMode"
            label="Dark Mode"
            description="Switch to dark theme"
            size="sm"
          >
            <Settings className="size-3" />
          </ToggleControl>
        </form>
      </Form>
    );
  },
};
