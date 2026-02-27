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

export const Default: StoryObj = {};
export const WithErrorMessage: StoryObj = {
  args: { error: new Error("Test error message") },
};

const CSRFErr = new Error("");
// @ts-ignore
CSRFErr.networkError = { result: { errors: [{ code: "EBADCSRFTOKEN" }] } };
export const CSRFError: StoryObj = {
  args: { error: CSRFErr },
};

const ProxyErr = new Error("");
// @ts-ignore
ProxyErr.networkError = { result: { errors: [{ code: "EPROXYUNREACHABLE" }] } };
export const ProxyUnreachableError: StoryObj = {
  args: { error: ProxyErr },
};

const ProxyUnknownErr = new Error("");
// @ts-ignore
ProxyUnknownErr.networkError = {
  result: { errors: [{ code: "EPROXYUNKNOWN" }] },
};
export const ProxyUnknownError: StoryObj = {
  args: { error: ProxyUnknownErr },
};
