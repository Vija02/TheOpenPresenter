import { appData } from "@repo/lib";
import { usePluginMetaData } from "@repo/shared";
import { useSearch } from "wouter";

export const useBackLink = () => {
  const { orgSlug, screenGuestSession } = usePluginMetaData();
  const search = useSearch();

  // When in proxy mode, use the cloud org slug for navigation back to projects
  const proxyConfig = appData.getProxyConfig();
  const projectsOrgSlug = proxyConfig.isProxy
    ? proxyConfig.cloudOrgSlug
    : orgSlug;

  const guestScreen = screenGuestSession?.screen ?? null;
  const appendSearch = (href: string) => (search ? `${href}?${search}` : href);

  return {
    href: guestScreen?.organization?.slug
      ? appendSearch(
          `/o/${guestScreen.organization.slug}/screens/${guestScreen.slug}/control`,
        )
      : appendSearch(`/o/${projectsOrgSlug}`),
    label: guestScreen ? "Screen control" : "Projects",
  };
};
