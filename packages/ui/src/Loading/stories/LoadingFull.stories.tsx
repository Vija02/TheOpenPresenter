import type { Meta, StoryObj } from "@storybook/react";

import { LoadingFull } from "../LoadingFull";

const meta = {
  title: "Indicators/LoadingFull",
  component: LoadingFull,
  tags: ["autodocs"],
  argTypes: {},
  args: { defer: 0 },
} satisfies Meta<typeof LoadingFull>;

export default meta;

export const Default: StoryObj = {};
