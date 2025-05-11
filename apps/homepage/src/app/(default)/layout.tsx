"use client";

import Footer from "@/components/ui/footer";
import Header from "@/components/ui/header";

import { InitAOS } from "../InitAOS";
import Theme from "../theme-provider";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <InitAOS />
      <Theme>
        <div className="flex flex-col min-h-screen overflow-hidden">
          <Header />
          <main className="grow">{children}</main>
          <Footer />
        </div>
      </Theme>
    </>
  );
}
