import { Link } from "@repo/ui";
import { useEffect } from "react";
import { VscArrowLeft } from "react-icons/vsc";

import { useMobileSidebar } from "../../contexts/mobileSidebar";
import { useBackLink } from "../../hooks/useBackLink";
import { SidebarContent } from "./SidebarWeb";

export const MobileDrawer = () => {
  const { isOpen, close } = useMobileSidebar();
  const { href: backHref, label: backLabel } = useBackLink();

  // Otherwise it reopens after the screen widens and narrows again
  useEffect(() => close, [close]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, close]);

  return (
    <>
      <div
        className="rt--mobile-drawer"
        data-open={isOpen}
        inert={!isOpen}
        data-testid="mobile-drawer"
      >
        <Link href={backHref} className="rt--mobile-drawer--back">
          <VscArrowLeft />
          Back to {backLabel.toLowerCase()}
        </Link>
        <SidebarContent collapsible={false} />
      </div>
      <div
        className="rt--mobile-drawer-backdrop"
        data-open={isOpen}
        onClick={close}
      />
    </>
  );
};
