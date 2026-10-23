import { cx } from "class-variance-authority";
import { useEffect, useState } from "react";
import { VscChevronRight } from "react-icons/vsc";

import "./SidebarSection.css";

/** Kept in step with the transitions in SidebarSection.css */
const COLLAPSE_MS = 200;

/** A collapsible section of the sidebar */
export const SidebarSection = ({
  title,
  isOpen: isOpenProp,
  onToggle,
  collapsible = true,
  headerExtra,
  actions,
  grow = false,
  children,
  testId,
}: {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  collapsible?: boolean;
  headerExtra?: React.ReactNode;
  actions?: React.ReactNode;
  /** Takes up the space left over by the other sections */
  grow?: boolean;
  children: React.ReactNode;
  testId?: string;
}) => {
  const isOpen = !collapsible || isOpenProp;
  const [isRendered, setIsRendered] = useState(isOpen);
  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
      return;
    }
    const timeout = setTimeout(() => setIsRendered(false), COLLAPSE_MS);
    return () => clearTimeout(timeout);
  }, [isOpen]);

  return (
    <section
      className={cx(
        "rt--sidebar-section",
        grow && "rt--sidebar-section__grow",
        isOpen && "rt--sidebar-section__open",
        !collapsible && "rt--sidebar-section__static",
      )}
      data-testid={testId}
    >
      <div className="rt--sidebar-section--header">
        {collapsible ? (
          <button
            type="button"
            className={cx(
              "rt--sidebar-section--toggle",
              // Leaves the extra right next to the title
              isOpen &&
                headerExtra !== undefined &&
                "rt--sidebar-section--toggle__fit",
            )}
            onClick={onToggle}
            aria-expanded={isOpen}
          >
            <VscChevronRight className="rt--sidebar-section--chevron" />
            <span>{title}</span>
          </button>
        ) : (
          <h2
            className={cx(
              "rt--sidebar-section--toggle",
              headerExtra !== undefined && "rt--sidebar-section--toggle__fit",
            )}
          >
            <span>{title}</span>
          </h2>
        )}
        {isOpen && headerExtra}
        {isOpen && actions !== undefined && (
          <span className="rt--sidebar-section--actions">{actions}</span>
        )}
      </div>
      <div className="rt--sidebar-section--body">
        <div className="rt--sidebar-section--body-inner">
          {isRendered && children}
        </div>
      </div>
    </section>
  );
};
