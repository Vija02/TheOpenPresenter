import type { Meta, StoryObj } from "@storybook/react";

import { LoadingDots } from "../LoadingDots";

const meta = {
  title: "Indicators/LoadingDots",
  component: LoadingDots,
  tags: ["autodocs"],
  argTypes: {
    count: { control: { type: "range", min: 2, max: 10 } },
    defer: { control: { type: "number" } },
  },
  args: { count: 5 },
} satisfies Meta<typeof LoadingDots>;

export default meta;

export const Default: StoryObj<typeof meta> = {};

export const ThreeDots: StoryObj<typeof meta> = {
  args: { count: 3 },
};

export const InheritsTextStyle: StoryObj<typeof meta> = {
  render: (args) => (
    <div className="stack-col items-start gap-3">
      <p className="text-2xs text-secondary">
        Working <LoadingDots {...args} />
      </p>
      <p className="text-base text-red-600">
        Working <LoadingDots {...args} />
      </p>
      <p className="text-2xl">
        Working <LoadingDots {...args} />
      </p>
    </div>
  ),
};

export const InContext: StoryObj<typeof meta> = {
  render: (args) => (
    <div className="rounded border border-stroke p-2 max-w-xs">
      <p className="text-2xs text-secondary italic">
        Reading the layout <LoadingDots {...args} label="" />
      </p>
    </div>
  ),
};
