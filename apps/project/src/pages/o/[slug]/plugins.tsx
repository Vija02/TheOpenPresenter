import { SharedOrgLayout } from "@/components/SharedOrgLayout";
import { PluginsPage } from "@/containers/Plugins/PluginsPage";
import {
  useOrganizationLoading,
  useOrganizationSlug,
} from "@/lib/permissionHooks/organization";
import { useOrganizationPluginsPageQuery } from "@repo/graphql";

const OrganizationPluginsPage = () => {
  const slug = useOrganizationSlug();
  const query = useOrganizationPluginsPageQuery({
    variables: { slug },
  });

  const organizationLoadingElement = useOrganizationLoading(query);

  return (
    <SharedOrgLayout title="Plugins" sharedOrgQuery={query}>
      {organizationLoadingElement || (
        <PluginsPage
          organization={query[0].data?.organizationBySlug!}
          refetch={() => query[1]({ requestPolicy: "network-only" })}
        />
      )}
    </SharedOrgLayout>
  );
};

export default OrganizationPluginsPage;
