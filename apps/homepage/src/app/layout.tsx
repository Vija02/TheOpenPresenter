import { Inter, Red_Hat_Display } from "next/font/google";
import React from "react";

import "./css/style.css";
import "./style.scss";

const DevCSSHack = React.lazy(() => import("./DevCSSHack"));

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const redhat = Red_Hat_Display({
  subsets: ["latin"],
  variable: "--font-red-hat-display",
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
      {process.env.NODE_ENV === "development" && <DevCSSHack />}
      <body
        className={`${inter.variable} ${redhat.variable} font-inter antialiased bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100 tracking-tight`}
      >
        {children}
      </body>
    </html>
  );
}
