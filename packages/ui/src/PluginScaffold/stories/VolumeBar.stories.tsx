import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";

import { VolumeBar } from "../VolumeBar";

const meta = {
  title: "Composite/VolumeBar",
  component: VolumeBar,
  tags: ["autodocs"],
  argTypes: {},
} satisfies Meta<typeof VolumeBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  decorators: [
    (Story, context) => (
      <div className="h-[80vh]">
        <Story {...context} />
      </div>
    ),
  ],
  render: () => {
    const [volume, setVolume] = useState(1);
    return <VolumeBar volume={volume} onChange={setVolume} />;
  },
};
