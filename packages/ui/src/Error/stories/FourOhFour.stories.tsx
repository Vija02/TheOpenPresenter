import type { Meta, StoryObj } from "@storybook/react";

import { FourOhFour } from "../FourOhFour";

const meta = {
  title: "Indicators/FourOhFour",
  component: FourOhFour,
  tags: ["autodocs"],
  argTypes: {},
  args: {},
} satisfies Meta<typeof FourOhFour>;

export default meta;

export const Default: StoryObj = {};
export const LoggedIn: StoryObj = { args: { loggedIn: true } };
