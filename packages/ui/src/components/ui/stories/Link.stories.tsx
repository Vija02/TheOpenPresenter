import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";

import { Link } from "../link";

const meta = {
  title: "Primitive/Link",
  component: Link,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: { type: "select" },
      options: ["default", "unstyled"],
    },
    isExternal: {
      control: { type: "boolean" },
    },
    asChild: {
      control: { type: "boolean" },
    },
  },
  args: {
    children: "Link text",
    href: "#",
    onClick: fn(),
  },
} satisfies Meta<typeof Link>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: "Default Link",
    href: "#",
  },
};

export const Unstyled: Story = {
  args: {
    children: "Unstyled Link",
    href: "#",
    variant: "unstyled",
  },
};

export const External: Story = {
  args: {
    children: "External Link",
    href: "https://example.com",
    isExternal: true,
  },
};

export const WithIcon: Story = {
  render: () => (
    <div className="space-y-4">
      <Link href="#" className="flex items-center gap-2">
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
            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
          />
        </svg>
        Link with Icon
      </Link>

      <Link
        href="https://example.com"
        isExternal
        className="flex items-center gap-2"
      >
        External Link
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
            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
          />
        </svg>
      </Link>
    </div>
  ),
};

export const InText: Story = {
  render: () => (
    <p className="text-gray-700">
      This is a paragraph with an{" "}
      <Link href="#" className="text-blue-600">
        inline link
      </Link>{" "}
      that demonstrates how links appear within text content. You can also have{" "}
      <Link href="https://example.com" isExternal className="text-blue-600">
        external links
      </Link>{" "}
      that open in a new tab.
    </p>
  ),
};

export const Variants: Story = {
  render: () => (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium mb-2">Default</h3>
        <Link href="#" variant="default">
          Default styled link
        </Link>
      </div>
      <div>
        <h3 className="text-sm font-medium mb-2">Unstyled</h3>
        <Link href="#" variant="unstyled">
          Unstyled link (inherits text color)
        </Link>
      </div>
    </div>
  ),
};

export const States: Story = {
  render: () => (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium mb-2">Normal</h3>
        <Link href="#">Normal link state</Link>
      </div>
      <div>
        <h3 className="text-sm font-medium mb-2">Disabled</h3>
        <Link
          href="#"
          className="pointer-events-none opacity-50 cursor-not-allowed"
          tabIndex={-1}
        >
          Disabled link
        </Link>
      </div>
    </div>
  ),
};
