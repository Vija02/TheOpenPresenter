"use client";

import BgShapes from "@/components/bg-shapes";
import Header from "@/components/ui/header";
import { styled } from "@/styled-system/jsx";

export default function DefaultLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <BgShapes />
      <Header />

      <styled.main flexGrow={1}>{children}</styled.main>
    </>
  );
}
