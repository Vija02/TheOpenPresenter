import { styled } from "@/styled-system/jsx";
import { Inter, Inter_Tight } from "next/font/google";

import "./style.css";
import Theme from "./theme-provider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const inter_tight = Inter_Tight({
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-inter-tight",
  display: "swap",
});

export const metadata = {
  title: "The Open Presenter",
  description: "Present everything with a few clicks",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html className="dark" lang="en" suppressHydrationWarning>
      {/* suppressHydrationWarning: https://github.com/vercel/next.js/issues/44343 */}
      <styled.body
        fontFamily="Inter, sans-serif"
        bg="indigo.100"
        color="gray.800"
        _dark={{
          bg: "gray.900",
          color: "gray.200",
        }}
        letterSpacing="tight"
        fontSmoothing="antialiased"
        className={`${inter.variable} ${inter_tight.variable}`}
      >
        <Theme>
          <styled.div
            position="relative"
            display="flex"
            flexDir="column"
            minH="screen"
            overflow="hidden"
            css={{
              "@supports (overflow: clip)": {
                overflow: "clip",
              },
            }}
          >
            {children}
          </styled.div>
        </Theme>
      </styled.body>
    </html>
  );
}
