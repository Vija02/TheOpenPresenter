import { RemoteBasePluginQuery, useRemoteBasePluginQuery } from "@repo/graphql";
import React, { createContext, useContext } from "react";

type PluginMetaDataProviderType = {
  pluginMetaData: RemoteBasePluginQuery | null;
};

const initialData: PluginMetaDataProviderType = {
  pluginMetaData: null,
};

export const PluginMetaDataContext =
  createContext<PluginMetaDataProviderType>(initialData);

export function PluginMetaDataProvider({
  children,
}: React.PropsWithChildren<{}>) {
  const { data: pluginMetaData } = useRemoteBasePluginQuery();

  return (
    <PluginMetaDataContext.Provider
      value={{
        pluginMetaData: pluginMetaData ?? null,
      }}
    >
      {!!pluginMetaData && children}
    </PluginMetaDataContext.Provider>
  );
}

export function usePluginMetaData() {
  return useContext(PluginMetaDataContext).pluginMetaData;
}
