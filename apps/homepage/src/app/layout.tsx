"use client";

import Footer from "@/components/ui/footer";
import Header from "@/components/ui/header";
import "aos/dist/aos.css";
import { Inter, Red_Hat_Display } from "next/font/google";

import { InitAOS } from "./InitAOS";
import "./css/compiled.css";
import "./style.scss";
import Theme from "./theme-provider";

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
    <html lang="en" suppressHydrationWarning>
      {/* suppressHydrationWarning: https://github.com/vercel/next.js/issues/44343 */}
      <body
        className={`${inter.variable} ${redhat.variable} font-inter antialiased bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100 tracking-tight`}
      >
        <InitAOS />
        <Theme>
          <div className="flex flex-col min-h-screen overflow-hidden">
            <Header />
            <main className="grow">{children}</main>
            <Footer />
          </div>
        </Theme>
      </body>
    </html>
  );
}
