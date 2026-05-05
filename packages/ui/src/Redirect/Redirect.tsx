import { cx } from "class-variance-authority";
import { useEffect } from "react";
import { useLocation } from "wouter";

import { Skeleton } from "../components/ui/skeleton";
import "./Redirect.css";

type PropTypes = {
  href: string;
  replace?: boolean;
  external?: boolean;
  children?: React.ReactNode;
  containerClassName?: string;
};

export function Redirect({
  href,
  replace = false,
  external = false,
  children,
  containerClassName,
}: PropTypes) {
  const [, navigate] = useLocation();

  useEffect(() => {
    if (external) {
      window.location.href = href;
      return;
    }
    navigate(href, { replace });
  }, [href, replace, external, navigate]);

  return (
    <div className={cx("ui--redirect", containerClassName)}>
      {children ?? (
        <>
          <h1 className="ui--redirect-heading">Redirecting...</h1>
          <Skeleton className="ui--redirect-row ui--redirect-row-1" />
          <Skeleton className="ui--redirect-row ui--redirect-row-2" />
          <Skeleton className="ui--redirect-row ui--redirect-row-3" />
          <Skeleton className="ui--redirect-row ui--redirect-row-4" />
        </>
      )}
    </div>
  );
}
