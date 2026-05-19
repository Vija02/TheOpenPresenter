import { useDisclosure } from "@/lib/useDisclosure";
import type { Meta, StoryObj } from "@storybook/react";
import { ChevronDownIcon, PlusIcon, TrashIcon } from "lucide-react";

import { Button } from "../button";
import {
  Popover,
  PopoverContent,
  PopoverMenuItem,
  PopoverTrigger,
} from "../popover";

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

/**
 * `PopoverMenuItem` styles a button to live inside a `PopoverContent` being
 * used as a dropdown menu. It auto-wraps in `PopoverClose` so activating an
 * item dismisses the popover.
 */
export const Menu: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="success" size="sm">
          <PlusIcon />
          New
          <ChevronDownIcon />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        hideArrow
        hideCloseButton
        className="w-64 p-1"
      >
        <PopoverMenuItem
          label="Project"
          description="Create a new project in this organization"
          onClick={() => console.log("project")}
        />
        <PopoverMenuItem
          label="Temporary project"
          description="Deleted once you stop using it"
          onClick={() => console.log("temporary")}
        />
      </PopoverContent>
    </Popover>
  ),
};

export const MenuItemLabelOnly: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm">Open</Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        hideArrow
        hideCloseButton
        className="w-48 p-1"
      >
        <PopoverMenuItem
          label="Edit"
          onClick={() => console.log("edit")}
        />
        <PopoverMenuItem
          label="Duplicate"
          onClick={() => console.log("duplicate")}
        />
        <PopoverMenuItem
          label="Archive"
          onClick={() => console.log("archive")}
        />
      </PopoverContent>
    </Popover>
  ),
};

export const MenuItemWithIcon: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline">
          Actions
          <ChevronDownIcon />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        hideArrow
        hideCloseButton
        className="w-56 p-1"
      >
        <PopoverMenuItem
          icon={<PlusIcon size={16} />}
          label="Add item"
          description="Append a new row to the list"
          onClick={() => console.log("add")}
        />
        <PopoverMenuItem
          icon={<TrashIcon size={16} />}
          label="Delete"
          description="Removes the item permanently"
          onClick={() => console.log("delete")}
        />
      </PopoverContent>
    </Popover>
  ),
};

export const MenuItemDisabled: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm">Open</Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        hideArrow
        hideCloseButton
        className="w-56 p-1"
      >
        <PopoverMenuItem
          label="Available action"
          description="This one is clickable"
          onClick={() => console.log("ok")}
        />
        <PopoverMenuItem
          label="Unavailable action"
          description="Disabled — cannot be clicked"
          disabled
          onClick={() => console.log("should not fire")}
        />
      </PopoverContent>
    </Popover>
  ),
};
