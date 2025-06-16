import type { Meta, StoryObj } from "@storybook/react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  List,
  ListOrdered,
  Underline,
} from "lucide-react";

import { ToggleGroup, ToggleGroupItem } from "../toggle-group";

const meta: Meta<typeof ToggleGroup> = {
  title: "Primitive/ToggleGroup",
  component: ToggleGroup,
  tags: ["autodocs"],
  argTypes: {
    size: {
      control: { type: "select" },
      options: ["default", "sm", "lg"],
    },
    type: {
      control: { type: "select" },
      options: ["single", "multiple"],
    },
    disabled: {
      control: { type: "boolean" },
    },
  },
};

export default meta;

type Story = StoryObj<typeof ToggleGroup>;

export const Default: Story = {
  args: {
    type: "multiple",
  },
  render: (args) => (
    <ToggleGroup {...args}>
      <ToggleGroupItem value="bold" aria-label="Toggle bold">
        <Bold className="size-4" />
      </ToggleGroupItem>
      <ToggleGroupItem value="italic" aria-label="Toggle italic">
        <Italic className="size-4" />
      </ToggleGroupItem>
      <ToggleGroupItem value="underline" aria-label="Toggle underline">
        <Underline className="size-4" />
      </ToggleGroupItem>
    </ToggleGroup>
  ),
};

export const SingleSelect: Story = {
  args: {
    type: "single",
  },
  render: (args) => (
    <ToggleGroup {...args}>
      <ToggleGroupItem value="left" aria-label="Align left">
        <AlignLeft className="size-4" />
      </ToggleGroupItem>
      <ToggleGroupItem value="center" aria-label="Align center">
        <AlignCenter className="size-4" />
      </ToggleGroupItem>
      <ToggleGroupItem value="right" aria-label="Align right">
        <AlignRight className="size-4" />
      </ToggleGroupItem>
    </ToggleGroup>
  ),
};

export const Small: Story = {
  args: {
    type: "multiple",
    size: "sm",
  },
  render: (args) => (
    <ToggleGroup {...args}>
      <ToggleGroupItem value="list" aria-label="Bullet list">
        <List className="size-3" />
      </ToggleGroupItem>
      <ToggleGroupItem value="ordered" aria-label="Numbered list">
        <ListOrdered className="size-3" />
      </ToggleGroupItem>
    </ToggleGroup>
  ),
};

export const Large: Story = {
  args: {
    type: "single",
    size: "lg",
  },
  render: (args) => (
    <ToggleGroup {...args}>
      <ToggleGroupItem value="left" aria-label="Align left">
        <AlignLeft className="size-4" />
      </ToggleGroupItem>
      <ToggleGroupItem value="center" aria-label="Align center">
        <AlignCenter className="size-4" />
      </ToggleGroupItem>
      <ToggleGroupItem value="right" aria-label="Align right">
        <AlignRight className="size-4" />
      </ToggleGroupItem>
    </ToggleGroup>
  ),
};

export const WithText: Story = {
  args: {
    type: "multiple",
  },
  render: (args) => (
    <ToggleGroup {...args}>
      <ToggleGroupItem value="bold" aria-label="Toggle bold">
        <Bold className="size-4" />
        Bold
      </ToggleGroupItem>
      <ToggleGroupItem value="italic" aria-label="Toggle italic">
        <Italic className="size-4" />
        Italic
      </ToggleGroupItem>
      <ToggleGroupItem value="underline" aria-label="Toggle underline">
        <Underline className="size-4" />
        Underline
      </ToggleGroupItem>
    </ToggleGroup>
  ),
};

export const Disabled: Story = {
  args: {
    type: "multiple",
    disabled: true,
  },
  render: (args) => (
    <ToggleGroup {...args}>
      <ToggleGroupItem value="bold" aria-label="Toggle bold">
        <Bold className="size-4" />
      </ToggleGroupItem>
      <ToggleGroupItem value="italic" aria-label="Toggle italic">
        <Italic className="size-4" />
      </ToggleGroupItem>
      <ToggleGroupItem value="underline" aria-label="Toggle underline">
        <Underline className="size-4" />
      </ToggleGroupItem>
    </ToggleGroup>
  ),
};
