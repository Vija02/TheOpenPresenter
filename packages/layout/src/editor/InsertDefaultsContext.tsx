import { ReactNode, createContext, useContext, useMemo } from "react";

import {
  LayoutInsertDefaults,
  NO_INSERT_DEFAULTS,
  mergePatch,
} from "./insertDefaults";

const LayoutInsertDefaultsContext =
  createContext<LayoutInsertDefaults>(NO_INSERT_DEFAULTS);

export const useLayoutInsertDefaults = (): LayoutInsertDefaults =>
  useContext(LayoutInsertDefaultsContext);

/** Nesting merges, so a sub-surface can narrow what its host already set. */
export const LayoutInsertDefaultsProvider = ({
  defaults = NO_INSERT_DEFAULTS,
  children,
}: {
  defaults?: LayoutInsertDefaults;
  children: ReactNode;
}) => {
  const inherited = useLayoutInsertDefaults();

  const value = useMemo(
    () => mergePatch(inherited, defaults),
    [inherited, defaults],
  );

  return (
    <LayoutInsertDefaultsContext.Provider value={value}>
      {children}
    </LayoutInsertDefaultsContext.Provider>
  );
};
