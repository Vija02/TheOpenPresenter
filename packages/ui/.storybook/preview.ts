import "@repo/tailwind-config/index.css";
import "@repo/tailwind-config/preflight.css";
import "@repo/tailwind-config/theme.css";
import type { Preview } from "@storybook/react";

import { withThemeProvider } from "./withThemeProvider";

const preview: Preview = {
  globalTypes: {
    theme: {
      description: "Global color scheme for components.",
      defaultValue: "light",
      toolbar: {
        title: "Color Scheme",
        icon: "mirror",
        items: [
          { value: "light", title: "Light Mode" },
          { value: "dark", title: "Dark Mode" },
        ],
        dynamicTitle: true,
      },
    },
  },
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: { disable: true },
  },
  decorators: [withThemeProvider],
};

export default preview;
