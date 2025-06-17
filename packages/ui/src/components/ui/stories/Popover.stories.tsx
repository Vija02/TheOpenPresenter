import { useDisclosure } from "@/lib/useDisclosure";
import type { Meta, StoryObj } from "@storybook/react";

import { Button } from "../button";
import { Popover, PopoverContent, PopoverTrigger } from "../popover";

const meta = {
  title: "Primitive/Popover",
  component: Popover,
  tags: ["autodocs"],
  argTypes: {},
  args: {},
} satisfies Meta<typeof Popover>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => {
    const { open, onToggle } = useDisclosure();

    return (
      <Popover open={open} onOpenChange={onToggle}>
        <PopoverTrigger asChild>
          <Button>Trigger</Button>
        </PopoverTrigger>
        <PopoverContent>Content</PopoverContent>
      </Popover>
    );
  },
};
