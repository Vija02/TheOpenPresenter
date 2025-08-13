import React from "react";

export const WrappedPasswordStrength = React.lazy(
  () => import("./PasswordStrength_DoNotImportDirectly"),
);
