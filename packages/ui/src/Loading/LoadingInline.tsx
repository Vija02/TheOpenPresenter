import { cx } from "class-variance-authority";
import { AiOutlineLoading3Quarters } from "react-icons/ai";

import { DeferredLoad } from "../DeferredLoad";

type PropTypes = {
  defer?: number;
  className?: string;
};

export function LoadingInline({ defer = 0, className }: PropTypes) {
  return (
    <DeferredLoad durationMs={defer}>
      <AiOutlineLoading3Quarters className={cx("animate-spin", className)} />
    </DeferredLoad>
  );
}
