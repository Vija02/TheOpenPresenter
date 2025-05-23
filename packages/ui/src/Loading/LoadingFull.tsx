import { cx } from "class-variance-authority";

import { DeferredLoad } from "..";
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
  return (
    <DeferredLoad durationMs={defer}>
      <div
        className={cx(
          "flex justify-center h-full pt-[30vh]",
          containerClassName,
        )}
      >
        <div className={cx("ui--loading-full", className)} />
      </div>
    </DeferredLoad>
  );
}
