import type { Meta, StoryObj } from "@storybook/react";

import { Alert } from "../alert";

const meta = {
  title: "Primitive/Alert",
  component: Alert,
  tags: ["autodocs"],
  argTypes: {},
} satisfies Meta<typeof Alert>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    variant: "default",
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
    title: "Your request has been successfully processed",
    subtitle: "",
    children: "Please wait for a few days for it to arrive in your inbox.",
  },
};

export const Destructive: Story = {
  args: {
    variant: "destructive",
    title: "An error occurred",
    subtitle: "Please try again",
    children:
      "Your connection to the server has ended. This should only happen in the rarest of occurrences.",
  },
};

export const Info: Story = {
  args: {
    variant: "info",
    title: "Your action is loading",
    subtitle: "Please wait while it loads",
    children:
      "This actions takes a long time to finish so please wait while it loads.",
  },
};

export const Warning: Story = {
  args: {
    variant: "warning",
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
