import type { Meta, StoryObj } from "@storybook/react";

import { ErrorOccurred } from "../ErrorOccurred";

const meta = {
  title: "Indicators/ErrorOccurred",
  component: ErrorOccurred,
  tags: ["autodocs"],
  argTypes: {},
  args: {},
} satisfies Meta<typeof ErrorOccurred>;

export default meta;

export const Default: StoryObj = {};
