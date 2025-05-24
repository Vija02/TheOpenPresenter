import { theme } from "@/theme";
import { ChakraProvider } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";

import { ErrorAlert } from "../ErrorAlert";

const meta = {
  title: "Indicators/ErrorAlert",
  component: ErrorAlert,
  tags: ["autodocs"],
  argTypes: {},
  args: {},
} satisfies Meta<typeof ErrorAlert>;

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
export const WithErrorMessage: StoryObj = {
  args: { error: new Error("Test error message") },
  decorators: [
    (Story, context) => (
      <div className="h-screen">
        <Story {...context} />
      </div>
    ),
  ],
};

const CSRFErr = new Error("");
// @ts-ignore
CSRFErr.networkError = { result: { errors: [{ code: "EBADCSRFTOKEN" }] } };
export const CSRFError: StoryObj = {
  args: { error: CSRFErr },
  decorators: [
    (Story, context) => (
      <div className="h-screen">
        <Story {...context} />
      </div>
    ),
  ],
};
