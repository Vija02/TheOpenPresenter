import React from "react";

type PropTypes = React.DetailedHTMLProps<
  React.HTMLAttributes<HTMLDivElement>,
  HTMLDivElement
> & { customMaxWidth?: number };

export const StandardWidth = React.forwardRef<HTMLDivElement, PropTypes>(
  ({ customMaxWidth, children, ...rest }, ref) => {
    return (
      <div
        ref={ref}
        style={{ display: "flex", flexDirection: "column", height: "100%" }}
        {...rest}
      >
        <div
          style={{
            marginInline: "auto",
            paddingBlock: "1.25rem",
            paddingInline: "1.25rem",
            width: "100%",
            maxWidth: customMaxWidth ? `${customMaxWidth}px` : "1200px",
          }}
        >
          {children}
        </div>
      </div>
    );
  },
);

StandardWidth.displayName = "StandardWidth";
