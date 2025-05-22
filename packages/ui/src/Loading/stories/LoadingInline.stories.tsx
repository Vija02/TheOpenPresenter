import type { Meta, StoryObj } from "@storybook/react";

import { LoadingInline } from "../LoadingInline";

const meta = {
  title: "Indicators/LoadingInline",
  component: LoadingInline,
  tags: ["autodocs"],
  argTypes: {},
  args: {},
} satisfies Meta<typeof LoadingInline>;

export default meta;

export const Default: StoryObj = {};
