import { usePluginMetaData } from "@repo/shared";
import { Button, Link } from "@repo/ui";
import { cx } from "class-variance-authority";
import { lazy } from "react";
import { MdCoPresent, MdOutlineCancelPresentation } from "react-icons/md";

import "./index.css";

const PresentMonitorModalWrapper = lazy(() => import("./PresentMonitorModal"));

export const PresentButton = ({ isMobile }: { isMobile?: boolean }) => {
  const { orgSlug, projectSlug } = usePluginMetaData();

  const PresentButtonElement = ({ onClick }: { onClick?: () => void }) => (
    <Button
      className={cx(["rt--present-button"])}
      variant="outline"
      size={isMobile ? "mini" : "default"}
      onClick={onClick}
    >
      <MdCoPresent />
      Present
    </Button>
  );
  const StopPresentButtonElement = ({ onClick }: { onClick?: () => void }) => (
    <Button
      className={cx(["rt--present-button"])}
      variant="outline"
      size={isMobile ? "mini" : "default"}
      onClick={onClick}
    >
      <MdOutlineCancelPresentation />
      Stop Presenting
    </Button>
  );

  if (window.__TAURI_INTERNALS__) {
    return (
      <PresentMonitorModalWrapper
        PresentButtonElement={PresentButtonElement}
        StopPresentButtonElement={StopPresentButtonElement}
      />
    );
  }

  return (
    <Link
      href={`/render/${orgSlug}/${projectSlug}`}
      isExternal
      className="rt--present-button-link"
      variant="unstyled"
    >
      <PresentButtonElement />
    </Link>
  );
};
