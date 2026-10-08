import { ReactNode, createContext, useContext } from "react";

const PublicAccessContext = createContext(false);

export const PublicAccessProvider = ({
  isPublicAccess,
  children,
}: {
  isPublicAccess: boolean;
  children: ReactNode;
}) => (
  <PublicAccessContext.Provider value={isPublicAccess}>
    {children}
  </PublicAccessContext.Provider>
);

export const usePublicAccess = () => useContext(PublicAccessContext);
