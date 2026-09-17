import { ReactNode, createContext, useContext } from "react";

import { HostElement } from "../../schema/element";

/**
 * Drawing live scene content needs the application's plugin machinery, which
 * lives above this package, so the app installs a renderer here.
 */
export type HostElementRenderer = (props: {
  element: HostElement;
}) => ReactNode;

export const HostRendererContext = createContext<HostElementRenderer | null>(
  null,
);

export const useHostRenderer = (): HostElementRenderer | null =>
  useContext(HostRendererContext);

export type HostRendererProviderProps = {
  render: HostElementRenderer;
  children: ReactNode;
};

export const HostRendererProvider = ({
  render,
  children,
}: HostRendererProviderProps) => (
  <HostRendererContext.Provider value={render}>
    {children}
  </HostRendererContext.Provider>
);
