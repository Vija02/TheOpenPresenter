import type { Meta, StoryObj } from "@storybook/react";

import { PasswordStrength } from "../PasswordStrength";

const meta = {
  title: "Misc/PasswordStrength",
  component: PasswordStrength,
  tags: ["autodocs"],
  argTypes: {},
  args: {
    isDirty: true,
    passwordStrength: 1,
    suggestions: [
      "Add another word or two. Uncommon words are better.",
      "This is similar to a commonly used password",
    ],
  },
} satisfies Meta<typeof PasswordStrength>;

export default meta;

export const Default: StoryObj = {};
