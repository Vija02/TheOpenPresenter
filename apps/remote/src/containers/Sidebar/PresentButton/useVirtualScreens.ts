import {
  useOrganizationScreensIndexPageQuery,
  useSetExistingProjectToScreenMutation,
} from "@repo/graphql";
import { captureEvent } from "@repo/observability/initAnalytics";
import { usePluginMetaData } from "@repo/shared";
import { toast } from "react-toastify";

export const useVirtualScreens = () => {
  const { orgSlug, projectId } = usePluginMetaData();
  const [{ data, fetching, error }, refetchScreens] =
    useOrganizationScreensIndexPageQuery({ variables: { slug: orgSlug } });
  const [{ fetching: assigning }, setExistingProjectToScreen] =
    useSetExistingProjectToScreenMutation();

  const screens = data?.organizationBySlug?.screens.nodes ?? [];
  const refresh = () => refetchScreens({ requestPolicy: "network-only" });

  const present = async (screenId: string, screenName: string) => {
    try {
      await setExistingProjectToScreen({ screenId, projectId });
      captureEvent("presented", { present_type: "screen" });
      toast.success(`Now presenting to ${screenName}`);
      refresh();
    } catch {
      toast.error(`Failed to present to ${screenName}`);
    }
  };

  const unassign = async (screenId: string, screenName: string) => {
    try {
      await setExistingProjectToScreen({ screenId, projectId: null });
      toast.success(`Stopped presenting to ${screenName}`);
      refresh();
    } catch {
      toast.error(`Failed to unassign ${screenName}`);
    }
  };

  return {
    screens,
    liveScreens: screens.filter((s) => s.currentProjectId === projectId),
    /** Eg. signed in as a guest */
    unavailable: !!error && !data,
    loading: fetching && !data,
    fetching,
    assigning,
    present,
    unassign,
  };
};
