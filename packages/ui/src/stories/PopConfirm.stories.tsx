import type { Meta, StoryObj } from "@storybook/react";

import { Button } from "..";
import { PopConfirm } from "../PopConfirm";

const meta = {
  title: "Composite/PopConfirm",
  component: PopConfirm,
  tags: ["autodocs"],
  argTypes: {
    title: { type: "string" },
    description: { type: "string" },
    okText: { type: "string" },
    cancelText: { type: "string" },
  },
  args: {
    onConfirm: () =>
      new Promise((resolve) => {
        setTimeout(resolve, 3000);
      }),
  },
} satisfies Meta<typeof PopConfirm>;

export default meta;

export const Default: StoryObj = {
  render: (args) => {
    return (
      <>
        <PopConfirm {...args}>
          <Button>Trigger delete</Button>
        </PopConfirm>
        <p className="mt-4 text-secondary">
          Tip: Hold shift while pressing the button to instantly confirm
        </p>
      </>
    );
  },
};
