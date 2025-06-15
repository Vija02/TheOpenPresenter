import { useInferLastSelectedOrganization } from "@/lib/useInferLastSelectedOrganization";
import { useSharedQuery } from "@repo/graphql";
import { ClientOnly } from "@repo/ui";
import Router from "next/router";
import React, { useEffect } from "react";

const OrganizationIndexWrapper = () => {
  return (
    <ClientOnly loadingComponent={<div>Redirecting...</div>}>
      <OrganizationIndex />
    </ClientOnly>
  );
};

const OrganizationIndex = () => {
  const query = useSharedQuery();

  const lastSelectedOrganization = useInferLastSelectedOrganization(query);

  useEffect(() => {
    if (!query.loading) {
      if (query.data?.currentUser) {
        if (lastSelectedOrganization) {
          Router.replace(`/o/${lastSelectedOrganization.slug}`);
        } else {
          Router.replace(`/org/create-organization`);
        }
      } else {
        // If not logged in
        Router.replace(`/logout?next=${encodeURIComponent("/login")}`);
      }
    }
  }, [lastSelectedOrganization, query.data?.currentUser, query.loading]);

  return <div>Redirecting...</div>;
};

export default OrganizationIndexWrapper;
