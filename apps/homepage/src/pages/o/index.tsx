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
          window.location.replace(`/o/${lastSelectedOrganization.slug}`);
        } else {
          Router.replace(`/create-organization`);
        }
      } else {
        // If not logged in
        Router.replace(`/login`);
      }
    }
  }, [lastSelectedOrganization, query.data?.currentUser, query.loading]);

  return <div>Redirecting...</div>;
};

export default OrganizationIndexWrapper;
