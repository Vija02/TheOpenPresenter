import { withSuspense } from "@repo/ui";
import React from "react";

const LazyPasswordStrength = React.lazy(
  () => import("./PasswordStrength_DoNotImportDirectly"),
);

export const WrappedPasswordStrength = withSuspense(LazyPasswordStrength);
