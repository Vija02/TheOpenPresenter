import { useInferLastSelectedOrganization } from "@/lib/useInferLastSelectedOrganization";
import { useSharedQuery } from "@repo/graphql";
import { ClientOnly } from "@repo/ui";
import { useEffect } from "react";
import { useLocation } from "wouter";

const OrganizationIndexWrapper = () => {
  return (
    <ClientOnly loadingComponent={<div>Redirecting...</div>}>
      <OrganizationIndex />
    </ClientOnly>
  );
};

const OrganizationIndex = () => {
  const query = useSharedQuery();
  const { fetching: loading, data } = query[0];
  const [, navigate] = useLocation();

  const lastSelectedOrganization = useInferLastSelectedOrganization(query);

  useEffect(() => {
    if (!loading) {
      if (data?.currentUser) {
        if (lastSelectedOrganization) {
          navigate(`/o/${lastSelectedOrganization.slug}`, { replace: true });
        } else {
          navigate(`/org/create-organization`, { replace: true });
        }
      } else {
        // If not logged in
        navigate(`/logout?next=${encodeURIComponent("/login")}`, {
          replace: true,
        });
      }
    }
  }, [lastSelectedOrganization, navigate, data?.currentUser, loading]);

  return <div>Redirecting...</div>;
};

export default OrganizationIndexWrapper;
