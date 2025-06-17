import { Decorator } from "@storybook/react";

import { cn } from "../src/lib/utils";

export const withThemeProvider: Decorator = (Story, context) => {
  const theme = context.globals.theme;

  return (
    <body
      className={cn(
        "sb-main-padded sb-show-main",
        theme === "dark" ? "dark" : "",
      )}
    >
      <Story />
    </body>
  );
};
