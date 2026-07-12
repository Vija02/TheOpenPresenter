import { ReactNode } from "react";

import { usePluginAPI } from "../../pluginApi";
import { trpc } from "../../trpc";

export const CustomTranslationsProvider = ({
  children,
}: {
  children: ReactNode;
}) => <>{children}</>;

export const useCustomTranslations = () => {
  const pluginApi = usePluginAPI();
  const pluginId = pluginApi.pluginContext.pluginId;

  const listQuery = trpc.bible.translations.list.useQuery(
    { pluginId },
    { refetchOnWindowFocus: false },
  );

  const translations = listQuery.data ?? [];

  return {
    translations,
    ready: listQuery.isSuccess,
    pluginId,
    get: (id: string) => translations.find((t) => t.id === id),
    refetch: listQuery.refetch,
  };
};
