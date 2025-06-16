import type { Meta, StoryObj } from "@storybook/react";

import { Alert } from "../alert";

const meta = {
  title: "Primitive/Alert",
  component: Alert,
  tags: ["autodocs"],
  argTypes: {
    size: {
      control: { type: "select" },
      options: ["default", "sm", "lg"],
    },
  },
  args: {
    size: "default",
  },
} satisfies Meta<typeof Alert>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    variant: "default",
    size: "default",
    title: "This feature is experimental and is subject to change",
    subtitle: "",
    children:
      "We are actively developing this feature. Some feature might be missing but it will be finished in the following week.",
  },
};

export const WithoutBody: Story = {
  render: () => (
    <div className="stack-col">
      <Alert {...Default.args} children={null} />
      <Alert {...Success.args} children={null} />
      <Alert {...Destructive.args} children={null} />
      <Alert {...Info.args} children={null} />
      <Alert {...Warning.args} children={null} />
    </div>
  ),
};

export const Success: Story = {
  args: {
    variant: "success",
    size: "default",
    title: "Your request has been successfully processed",
    subtitle: "",
    children: "Please wait for a few days for it to arrive in your inbox.",
  },
};

export const Destructive: Story = {
  args: {
    variant: "destructive",
    size: "default",
    title: "An error occurred",
    subtitle: "Please try again",
    children:
      "Your connection to the server has ended. This should only happen in the rarest of occurrences.",
  },
};

export const Info: Story = {
  args: {
    variant: "info",
    size: "default",
    title: "Your action is loading",
    subtitle: "Please wait while it loads",
    children:
      "This actions takes a long time to finish so please wait while it loads.",
  },
};

export const Warning: Story = {
  args: {
    variant: "warning",
    size: "default",
    title: "Before you continue, the following actions need to be taken:",
    subtitle: "",
    children: (
      <>
        1. Create a new project.
        <br />
        2. Upload a new picture.
      </>
    ),
  },
};

export const VariantAndSize: Story = {
  render: () => (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium mb-2">Small Size</h3>
        <div className="space-y-2">
          <Alert
            variant="default"
            size="sm"
            title="Default Alert"
            subtitle="Small size"
          >
            This is a small default alert with body content.
          </Alert>
          <Alert
            variant="success"
            size="sm"
            title="Success Alert"
            subtitle="Small size"
          >
            This is a small success alert with body content.
          </Alert>
          <Alert
            variant="destructive"
            size="sm"
            title="Error Alert"
            subtitle="Small size"
          >
            This is a small error alert with body content.
          </Alert>
          <Alert
            variant="info"
            size="sm"
            title="Info Alert"
            subtitle="Small size"
          >
            This is a small info alert with body content.
          </Alert>
          <Alert
            variant="warning"
            size="sm"
            title="Warning Alert"
            subtitle="Small size"
          >
            This is a small warning alert with body content.
          </Alert>
        </div>
      </div>
      <div>
        <h3 className="text-sm font-medium mb-2">Default Size</h3>
        <div className="space-y-2">
          <Alert
            variant="default"
            size="default"
            title="Default Alert"
            subtitle="Default size"
          >
            This is a default size alert with body content.
          </Alert>
          <Alert
            variant="success"
            size="default"
            title="Success Alert"
            subtitle="Default size"
          >
            This is a default size success alert with body content.
          </Alert>
          <Alert
            variant="destructive"
            size="default"
            title="Error Alert"
            subtitle="Default size"
          >
            This is a default size error alert with body content.
          </Alert>
          <Alert
            variant="info"
            size="default"
            title="Info Alert"
            subtitle="Default size"
          >
            This is a default size info alert with body content.
          </Alert>
          <Alert
            variant="warning"
            size="default"
            title="Warning Alert"
            subtitle="Default size"
          >
            This is a default size warning alert with body content.
          </Alert>
        </div>
      </div>
    </div>
  ),
};
