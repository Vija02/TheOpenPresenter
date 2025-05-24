import { cn } from "@/lib/utils";
import { type VariantProps, cva } from "class-variance-authority";
import * as React from "react";
import { FaCheck, FaExclamation } from "react-icons/fa6";
import { IoWarningOutline } from "react-icons/io5";
import { TfiInfoAlt } from "react-icons/tfi";

import "./alert.css";

const alertVariants = cva("ui--alert-heading", {
  variants: {
    variant: {
      default: "bg-fill-default text-fill-default-fg",
      success: "bg-fill-success text-fill-success-fg",
      destructive: "bg-fill-destructive text-fill-destructive-fg",
      info: "bg-fill-info text-fill-info-fg",
      warning: "bg-fill-warning text-fill-warning-fg",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

function Alert({
  variant,
  title,
  subtitle,
  titleProps,
  subtitleProps,
  bodyProps,
  children,
  className,
  ...props
}: React.ComponentProps<"div"> &
  VariantProps<typeof alertVariants> & {
    title?: string;
    subtitle?: string;
    titleProps?: React.ComponentProps<"div">;
    subtitleProps?: React.ComponentProps<"div">;
    bodyProps?: React.ComponentProps<"div">;
    children?: React.ReactNode;
  }) {
  return (
    <div
      data-slot="alert"
      role="alert"
      {...props}
      className={cn("ui--alert", className)}
    >
      <div data-slot="alert-heading" className={cn(alertVariants({ variant }))}>
        {(variant === "info" || variant === "default") && <TfiInfoAlt />}
        {variant === "success" && <FaCheck />}
        {variant === "destructive" && <FaExclamation />}
        {variant === "warning" && <IoWarningOutline />}
        <div className="flex flex-wrap">
          <span
            data-slot="alert-title"
            {...titleProps}
            className={cn(
              "font-semibold stack-row inline-flex pr-3",
              titleProps?.className,
            )}
          >
            {title}
          </span>
          <span
            data-slot="alert-subtitle"
            {...subtitleProps}
            className={cn("opacity-85", subtitleProps?.className)}
          >
            {subtitle}
          </span>
        </div>
      </div>
      {children && (
        <div
          {...bodyProps}
          className={cn(
            "col-start-2 grid justify-items-start gap-1 text-sm [&_p]:leading-relaxed",
            bodyProps?.className,
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export { Alert };
