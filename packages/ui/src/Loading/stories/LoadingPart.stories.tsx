import type { Meta, StoryObj } from "@storybook/react";

import { LoadingPart } from "../LoadingPart";

const meta = {
  title: "Indicators/LoadingPart",
  component: LoadingPart,
  tags: ["autodocs"],
  argTypes: {},
  args: {},
} satisfies Meta<typeof LoadingPart>;

export default meta;

export const Default: StoryObj = {
  decorators: [
    (Story, context) => (
      <div className="h-screen">
        <Story {...context} />
      </div>
    ),
  ],
};
