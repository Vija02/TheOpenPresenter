import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";

import { Input } from "../input";
import { Label } from "../label";

const meta = {
  title: "Primitive/Label",
  component: Label,
  tags: ["autodocs"],
  argTypes: {},
  args: {
    children: "Label text",
    onClick: fn(),
  },
} satisfies Meta<typeof Label>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: "Default Label",
  },
};

export const WithInput: Story = {
  render: () => (
    <div className="space-y-2">
      <Label htmlFor="email">Email Address</Label>
      <Input id="email" type="email" placeholder="Enter your email" />
    </div>
  ),
};

export const Required: Story = {
  render: () => (
    <div className="space-y-2">
      <Label htmlFor="username">
        Username <span className="text-red-500">*</span>
      </Label>
      <Input id="username" placeholder="Enter username" required />
    </div>
  ),
};

export const WithDescription: Story = {
  render: () => (
    <div className="space-y-2">
      <Label htmlFor="password">
        Password
        <span className="text-xs text-gray-500 font-normal ml-2">
          (Must be at least 8 characters)
        </span>
      </Label>
      <Input id="password" type="password" placeholder="Enter password" />
    </div>
  ),
};

export const Disabled: Story = {
  render: () => (
    <div className="space-y-2 group" data-disabled="true">
      <Label htmlFor="disabled-input">Disabled Field</Label>
      <Input id="disabled-input" placeholder="Cannot edit" disabled />
    </div>
  ),
};

export const MultipleLabels: Story = {
  render: () => (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="first-name">First Name</Label>
        <Input id="first-name" placeholder="John" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="last-name">Last Name</Label>
        <Input id="last-name" placeholder="Doe" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">
          Phone Number
          <span className="text-xs text-gray-500 font-normal ml-2">
            (Optional)
          </span>
        </Label>
        <Input id="phone" type="tel" placeholder="+1 (555) 123-4567" />
      </div>
    </div>
  ),
};

export const WithIcon: Story = {
  render: () => (
    <div className="space-y-2">
      <Label htmlFor="search" className="flex items-center gap-2">
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        Search
      </Label>
      <Input id="search" type="search" placeholder="Search..." />
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="small" className="text-xs">
          Small Label
        </Label>
        <Input id="small" placeholder="Small input" className="h-8 text-sm" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="default">Default Label</Label>
        <Input id="default" placeholder="Default input" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="large" className="text-base">
          Large Label
        </Label>
        <Input id="large" placeholder="Large input" className="h-12 text-lg" />
      </div>
    </div>
  ),
};