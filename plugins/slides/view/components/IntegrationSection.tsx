import { ReactNode } from "react";

export const IntegrationSection = ({
  children,
  title = "Or import from integration",
  className = "",
}: {
  children: ReactNode;
  title?: string;
  className?: string;
}) => (
  <div className={`flex flex-col gap-3 ${className}`}>
    <p className="text-lg font-semibold text-primary">{title}</p>
    <div className="flex flex-wrap gap-4">{children}</div>
  </div>
);
