"use client";

import { ThemeProvider } from "next-themes";

export default function Theme({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      forcedTheme="dark"
      enableSystem={false}
      attribute="class"
      enableColorScheme={false}
      disableTransitionOnChange
    >
      {children}
    </ThemeProvider>
  );
}
