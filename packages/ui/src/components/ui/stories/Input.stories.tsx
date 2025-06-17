import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";

import { Input } from "../input";

const meta = {
  title: "Primitive/Input",
  component: Input,
  tags: ["autodocs"],
  argTypes: {
    type: {
      control: { type: "select" },
      options: ["text", "email", "password", "number", "tel", "url", "search"],
    },
    disabled: {
      control: { type: "boolean" },
    },
  },
  args: {
    placeholder: "Enter text...",
    onChange: fn(),
    onFocus: fn(),
    onBlur: fn(),
  },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    placeholder: "Default input",
  },
};

export const WithValue: Story = {
  args: {
    value: "Sample text",
    placeholder: "Input with value",
  },
};

export const Password: Story = {
  args: {
    type: "password",
    placeholder: "Enter password",
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    placeholder: "Disabled input",
    value: "Cannot edit this",
  },
};

export const WithError: Story = {
  args: {
    placeholder: "Input with error state",
    "aria-invalid": true,
    className: "border-red-500 focus:border-red-500",
  },
};

export const Sizes: Story = {
  render: () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">Small</label>
        <Input placeholder="Small input" className="h-8 text-sm" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-2">Default</label>
        <Input placeholder="Default input" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-2">Large</label>
        <Input placeholder="Large input" className="h-12 text-lg" />
      </div>
    </div>
  ),
};

export const InputTypes: Story = {
  render: () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">Text</label>
        <Input type="text" placeholder="Text input" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-2">Email</label>
        <Input type="email" placeholder="email@example.com" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-2">Password</label>
        <Input type="password" placeholder="Password" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-2">Tel</label>
        <Input type="tel" placeholder="+1 (555) 123-4567" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-2">URL</label>
        <Input type="url" placeholder="https://example.com" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-2">Search</label>
        <Input type="search" placeholder="Search..." />
      </div>
    </div>
  ),
};

export const States: Story = {
  render: () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">Normal</label>
        <Input placeholder="Normal state" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-2">Auto Focused</label>
        <Input placeholder="Auto Focused state" autoFocus />
      </div>
      <div>
        <label className="block text-sm font-medium mb-2">Disabled</label>
        <Input placeholder="Disabled state" disabled />
      </div>
      <div>
        <label className="block text-sm font-medium mb-2">Read Only</label>
        <Input value="Read only value" readOnly />
      </div>
    </div>
  ),
};
