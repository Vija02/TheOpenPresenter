import type { Meta, StoryObj } from "@storybook/react";
import { Router, useLocation } from "wouter";
import { memoryLocation } from "wouter/memory-location";

import { Redirect } from "./Redirect";

// Storybook decorator: wrap each story in an isolated wouter Router backed
// by an in-memory location hook, so the redirect doesn't actually navigate
// the Storybook iframe away. We surface the resulting "current path" under
// the rendered Redirect so the story makes the side-effect visible.
const withMemoryRouter = (initialPath = "/start") => {
  const Decorator = (Story: () => JSX.Element) => {
    const { hook } = memoryLocation({ path: initialPath, record: true });
    return (
      <Router hook={hook}>
        <CurrentPath />
        <Story />
      </Router>
    );
  };
  return Decorator;
};

const CurrentPath = () => {
  const [path] = useLocation();
  return (
    <div className="border border-stroke rounded p-2 mb-3 text-xs text-secondary">
      <span className="font-mono">current path:</span>{" "}
      <span className="font-mono text-primary">{path}</span>
    </div>
  );
};

const meta = {
  title: "Navigation/Redirect",
  component: Redirect,
  tags: ["autodocs"],
  argTypes: {
    href: { control: "text" },
    replace: { control: "boolean" },
    external: {
      control: "boolean",
      description:
        "Full-page navigation via window.location.href. Not exercised in Storybook (would unload the iframe).",
    },
  },
  args: { href: "/destination" },
} satisfies Meta<typeof Redirect>;

export default meta;

type Story = StoryObj<typeof Redirect>;

// Default: skeleton fallback while the SPA redirect fires on mount.
export const Default: Story = {
  decorators: [withMemoryRouter("/start")],
};

// Custom in-flight UI passed via children — overrides the default skeleton stack.
export const WithCustomChildren: Story = {
  decorators: [withMemoryRouter("/start")],
  args: {
    children: (
      <p className="text-sm text-secondary">Hold on, taking you there...</p>
    ),
  },
};

// Replace mode: history entry is replaced instead of pushed. Visually
// identical to Default; behaviour difference shows up in browser history.
export const Replace: Story = {
  decorators: [withMemoryRouter("/start")],
  args: { replace: true },
};
