import { BiblePreferences } from "../../src/types";
import { usePluginAPI } from "../pluginApi";
import { trpc } from "../trpc";

// The organization's preferences, or for public visitors (who can't save to
// the organization) this scene's own copy, falling back to the defaults.
export const usePreferences = () => {
  const pluginApi = usePluginAPI();
  const pluginId = pluginApi.pluginContext.pluginId;
  const isPublicAccess = pluginApi.isPublicAccess;
  const mutableSceneData = pluginApi.scene.useValtioData();
  const scenePreferences = pluginApi.scene.useData(
    (x) => x.pluginData.preferences,
  );
  const utils = trpc.useUtils();

  const query = trpc.bible.preferences.get.useQuery(
    { pluginId },
    { refetchOnWindowFocus: false },
  );
  const setMutation = trpc.bible.preferences.set.useMutation();

  const sceneData = isPublicAccess ? scenePreferences : null;
  const data = sceneData ?? query.data;

  const save = async (preferences: BiblePreferences) => {
    if (isPublicAccess) {
      mutableSceneData.pluginData.preferences = {
        languages: [...preferences.languages],
        translationIds: [...preferences.translationIds],
        primaryTranslationId: preferences.primaryTranslationId,
        favoriteIds: [...preferences.favoriteIds],
      };
      return;
    }
    await setMutation.mutateAsync({ pluginId, ...preferences });
    await utils.bible.preferences.get.invalidate();
  };

  return {
    data,
    isLoading: !sceneData && query.isLoading,
    error: sceneData ? null : query.error,
    refetch: query.refetch,
    save,
    saveError: setMutation.error,
  };
};
