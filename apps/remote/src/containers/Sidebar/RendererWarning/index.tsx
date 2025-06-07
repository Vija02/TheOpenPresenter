import { useAwareness } from "@repo/shared";
import { OverlayToggle } from "@repo/ui";
import { FaChevronRight } from "react-icons/fa";
import { FaTriangleExclamation } from "react-icons/fa6";

import { RendererWarningModal } from "./RendererWarningModal";
import "./index.css";

export const RendererWarning = () => {
  const { awarenessData } = useAwareness();

  const allErrors = awarenessData.map((x) => x.user?.errors ?? []).flat();

  if (allErrors.length === 0) {
    return null;
  }

  return (
    <OverlayToggle
      toggler={({ onToggle }) => (
        <div className="rt--renderer-warning-container" onClick={onToggle}>
          <div className="rt--renderer-warning--inner">
            <FaTriangleExclamation />
            <p>
              {allErrors.length} <span>Warning</span>
            </p>
          </div>
          <FaChevronRight className="rt--renderer-warning--chevron" />
        </div>
      )}
    >
      <RendererWarningModal />
    </OverlayToggle>
  );
};
