import Footer from "@/components/ui/footer";
import Header from "@/components/ui/header";

import Theme from "../theme-provider";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Theme>
        <div className="flex flex-col min-h-dvh overflow-hidden">
          <Header />
          <main className="grow">{children}</main>
          <Footer />
        </div>
      </Theme>
    </>
  );
}
