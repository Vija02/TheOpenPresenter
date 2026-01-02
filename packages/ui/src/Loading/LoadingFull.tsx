import { cx } from "class-variance-authority";
import { useEffect, useState } from "react";

import { DeferredLoad } from "..";
import { Link } from "../components/ui/link";
import "./LoadingFull.css";

type PropTypes = {
  defer?: number;
  containerClassName?: string;
  className?: string;
};

export function LoadingFull({
  defer = 0,
  containerClassName,
  className,
}: PropTypes) {
  const [showReloadPrompt, setShowReloadPrompt] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowReloadPrompt(true);
    }, 15000);

    return () => clearTimeout(timer);
  }, []);

  const handleReload = () => {
    window.location.reload();
  };

  return (
    <DeferredLoad durationMs={defer}>
      <div className={cx("center pt-[30vh]", containerClassName)}>
        <div className="ui--loading-full-wrapper">
          <div className={cx("ui--loading-full", className)} />
          {showReloadPrompt && (
            <Link
              href="#"
              onClick={(e) => {
                e.preventDefault();
                handleReload();
              }}
              className="ui--loading-full-reload"
            >
              Page not loading? Click here to reload
            </Link>
          )}
        </div>
      </div>
    </DeferredLoad>
  );
}
