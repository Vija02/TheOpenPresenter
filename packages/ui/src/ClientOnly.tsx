import { useEffect, useState } from "react";

export type ClientOnlyPropTypes = {
  children: React.ReactNode;
  loadingComponent: React.ReactNode;
};

// https://www.joshwcomeau.com/react/the-perils-of-rehydration/
export const ClientOnly = ({
  children,
  loadingComponent,
}: ClientOnlyPropTypes) => {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (!hasMounted) {
    return <>{loadingComponent}</>;
  }

  return <>{children}</>;
};
