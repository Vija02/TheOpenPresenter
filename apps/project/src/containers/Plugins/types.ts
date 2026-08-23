import { OrganizationPluginsInfoFragment } from "@repo/graphql";

export type Organization = NonNullable<
  OrganizationPluginsInfoFragment["organizationBySlug"]
>;

export type Plugin =
  Organization["clientPluginsByOwnerOrganizationId"]["nodes"][number];

export type PluginVersion = Plugin["clientPluginVersions"]["nodes"][number];
