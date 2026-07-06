import { ReactNode } from "react";

export const SectionHeading = ({ children }: { children: ReactNode }) => (
  <h3 className="text-sm font-bold text-secondary">{children}</h3>
);
