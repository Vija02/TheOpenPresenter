import { Redirect } from "@/components/Redirect";
import { SharedOrgLayout } from "@/components/SharedOrgLayout";
import { useOrganizationSlug } from "@/lib/permissionHooks/organization";
import { useOrganizationLatestIndexPageQuery } from "@repo/graphql";
import { ClientOnly } from "@repo/ui";
import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";

const LatestIndexWrapper = () => {
  const { type } = useParams();

  if (type !== "app" && type !== "render") {
    return <Redirect href="/o" />;
  }

  return (
    <ClientOnly loadingComponent={<div>Redirecting...</div>}>
      <LatestIndexClientWrapper />
    </ClientOnly>
  );
};

const LatestIndexClientWrapper = () => {
  const slug = useOrganizationSlug();
  const { type } = useParams();
  const [isEmpty, setIsEmpty] = useState(false);

  const query = useOrganizationLatestIndexPageQuery({ variables: { slug } });

  const { fetching: loading, data } = query[0];
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading) {
      if ((data?.organizationBySlug?.projects.nodes.length ?? 0) > 0) {
        navigate(
          `/${type}/${slug}/${data?.organizationBySlug?.projects.nodes[0]?.slug}`,
          { replace: true },
        );
      } else {
        setIsEmpty(true);
        // If no projects
      }
    }
  }, [data?.organizationBySlug?.projects.nodes, loading, navigate, slug, type]);

  return (
    <SharedOrgLayout title="Latest Project" sharedOrgQuery={query}>
      {isEmpty && (
        <p>
          Tried to open the latest project, but unable to find any. Please
          create a project to start using this feature
        </p>
      )}
      {!isEmpty && <div>Redirecting...</div>}
    </SharedOrgLayout>
  );
};

export default LatestIndexWrapper;
