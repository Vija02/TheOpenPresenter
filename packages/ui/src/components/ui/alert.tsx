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
      default: "ui--alert-heading__default",
      success: "ui--alert-heading__success",
      destructive: "ui--alert-heading__destructive",
      info: "ui--alert-heading__info",
      warning: "ui--alert-heading__warning",
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
        <div className="ui--alert-heading-container">
          <span
            data-slot="alert-title"
            {...titleProps}
            className={cn("ui--alert-title", titleProps?.className)}
          >
            {title}
          </span>
          <span
            data-slot="alert-subtitle"
            {...subtitleProps}
            className={cn("ui--alert-subtitle", subtitleProps?.className)}
          >
            {subtitle}
          </span>
        </div>
      </div>
      {children && (
        <div
          {...bodyProps}
          className={cn("ui--alert-body", bodyProps?.className)}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export { Alert };
